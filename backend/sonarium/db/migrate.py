"""Running the migrations from inside the process (``OPS-7``).

Principle 5 -- an archive does not break -- is why versioned migrations exist from the first
commit, and why the upgrade is not something an administrator has to remember to run. An
instance migrates itself at startup, under a lock, so that the ordinary way to upgrade is to
pull a new image and restart.

**The lock is a file lock, not a thread lock.** The thing being guarded against is two
*processes* starting at once against the same volume -- a restart that overlaps its
predecessor, or somebody running ``sonarium migrate`` by hand while the container comes up.
A ``threading.Lock`` would look like it solved that and would not. ``flock`` coordinates every
process on the host sharing the volume, which is exactly the scope this topology has; it does
not coordinate across hosts, and neither does a single SQLite file, so nothing is lost.

The Alembic configuration is built in code rather than read from ``alembic.ini``. The ini file is
for the ``alembic`` command line; this path resolves the same migration tree from the package's
own location, so a running instance cannot be pointed at a different set of revisions than the
one it shipped with.
"""

from __future__ import annotations

import fcntl
import os
import time
from contextlib import contextmanager
from pathlib import Path
from typing import TYPE_CHECKING

import structlog
from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Connection, Engine

from sonarium.core.config import Settings
from sonarium.core.errors import ConfigurationError
from sonarium.db.engine import build_engine

if TYPE_CHECKING:
    from collections.abc import Iterator

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = BACKEND_ROOT / "migrations"
LOCK_NAME = "sonarium.migrate.lock"

_logger = structlog.get_logger(__name__)


def alembic_config() -> Config:
    """The migration tree that shipped with this code."""
    if not MIGRATIONS_DIR.is_dir():
        raise ConfigurationError(
            f"The migration tree is missing: expected it at {MIGRATIONS_DIR}. "
            "The database cannot be created or upgraded without it."
        )
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    return config


def upgrade_to_head(engine: Engine) -> None:
    """Bring one database up to the latest revision.

    The connection is handed to ``env.py`` through Alembic's attributes rather than left to be
    opened from a URL: it is the only way to migrate an in-memory database, which exists only for
    as long as the connection that opened it, and it means the migration runs with the same
    pragmas as everything else.
    """
    with engine.begin() as connection:
        run_upgrade(connection)


def run_upgrade(connection: Connection, revision: str = "head") -> None:
    """Upgrade over a connection the caller already owns and has a transaction on."""
    config = alembic_config()
    config.attributes["connection"] = connection
    command.upgrade(config, revision)


@contextmanager
def migration_lock(settings: Settings, *, timeout_seconds: float = 60.0) -> Iterator[None]:
    """Hold the exclusive right to migrate, or wait for whoever has it.

    Waiting rather than failing is deliberate. Two containers coming up together is an ordinary
    event -- a restart, a compose ``up`` after an image pull -- and the second one should start
    normally a moment later, not exit and be restarted by the orchestrator.

    An in-memory database has nowhere to put a lock file and no second process to race, so it
    skips this entirely.
    """
    if settings.is_memory_database:
        yield
        return
    path = settings.resolved_database_path.parent / LOCK_NAME
    path.parent.mkdir(parents=True, exist_ok=True)
    handle = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        _acquire(handle, path, timeout_seconds)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
    finally:
        os.close(handle)


def _acquire(handle: int, path: Path, timeout_seconds: float) -> None:
    """Take the lock, saying so if the wait is long enough for anybody to notice."""
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        return
    except BlockingIOError:
        _logger.info("migrate.waiting", lock=str(path))
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return
        except BlockingIOError:
            time.sleep(0.2)
    raise ConfigurationError(
        f"Another process has been holding the migration lock at {path} for more than "
        f"{timeout_seconds:.0f}s. If nothing else is starting up, delete that file and restart."
    )


def revisions(engine: Engine) -> tuple[str | None, str | None]:
    """What the database is at, and what this build expects.

    Both halves are what an operator needs when an upgrade goes wrong: the pair says whether to
    roll the image back or the database forward.
    """
    script = ScriptDirectory.from_config(alembic_config())
    head = script.get_current_head()
    with engine.connect() as connection:
        current = MigrationContext.configure(connection).get_current_revision()
    return current, head


def migrate_at_startup(settings: Settings) -> tuple[str | None, str | None]:
    """Bring this instance's database up to date, under the lock (``OPS-7``).

    Returns the revisions before and after, so the caller can log the fact that an upgrade
    happened -- which is the line somebody looks for when an instance starts behaving differently
    after a restart.
    """
    engine = build_engine(settings)
    try:
        with migration_lock(settings):
            before, head = revisions(engine)
            if before == head:
                return before, head
            _logger.info("migrate.upgrading", from_revision=before, to_revision=head)
            upgrade_to_head(engine)
            after, _ = revisions(engine)
            return before, after
    finally:
        engine.dispose()


def downgrade(engine: Engine, revision: str) -> None:
    """Roll the schema back to a named revision.

    Deliberately not called by anything automatic. Down-migrations are exercised far less than
    up-migrations, and a rollback that runs by itself when a container fails to start is how one
    bad deploy becomes a lost archive. ``deploy/README.md`` documents the path this belongs to:
    restore the backup, then roll the image back.
    """
    config = alembic_config()
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, revision)
