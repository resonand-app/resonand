"""Running the migrations from inside the process.

Principle 5 -- an archive does not break -- is why versioned migrations exist from the first
commit, and why the upgrade is not something an administrator has to remember to run. ``OPS-7``
wraps :func:`upgrade_to_head` in a lock so that two containers starting at once cannot both
migrate; that lock is deliberately **not** here, because it belongs to whatever coordinates the
processes, and putting a threading lock here would look like it solved the problem.

The Alembic configuration is built in code rather than read from ``alembic.ini``. The ini file is
for the ``alembic`` command line; this path resolves the same migration tree from the package's
own location, so a running instance cannot be pointed at a different set of revisions than the
one it shipped with.
"""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine

from sonarium.core.errors import ConfigurationError

BACKEND_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = BACKEND_ROOT / "migrations"


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
