"""Backup and restore (``OPS-6``).

The metric the vision names and almost nobody measures is **whether instances survive upgrades**.
This is the half of that within the software's control: a consistent copy of the database taken
without stopping the service, and a restore that has actually been performed.

``VACUUM INTO`` is why this can run live. Copying a SQLite file in WAL mode with ``cp`` is a way
to get a torn database -- the file and its write-ahead log are two things and a copy catches them
at different moments. ``VACUUM INTO`` asks SQLite for a consistent snapshot and gets one, from a
read transaction, while the service keeps writing.

The **originals are not copied here**, and that is deliberate. They are immutable, they are the
bulk of the archive by orders of magnitude, and copying hundreds of gigabytes on a schedule that
suits a 40 MB database is how backups stop being run. :func:`storage_note` says what to point a
file-level backup at instead.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import text

from sonarium.core.config import Settings
from sonarium.core.errors import ConflictError, InvalidRequestError
from sonarium.core.time import now_instant
from sonarium.db.engine import build_engine

DATABASE_BACKUP_SUFFIX = ".sqlite"


@dataclass(frozen=True, slots=True)
class BackupResult:
    """What one backup wrote."""

    path: Path
    size_bytes: int
    taken_at: str


def backup_database(settings: Settings, destination: Path) -> BackupResult:
    """Take a consistent copy of the database while the service keeps running.

    Refuses to overwrite. A backup command that silently replaced yesterday's copy would turn one
    bad night into no history at all.
    """
    if settings.is_memory_database:
        raise InvalidRequestError("An in-memory database has nothing to back up.")
    if destination.exists():
        raise ConflictError(f"{destination} already exists. Backups are never overwritten.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            # The path is interpolated because VACUUM INTO takes a literal, not a bound
            # parameter. It comes from the operator's own command line, and the quotes are
            # doubled so a path with one in it cannot end the string early.
            literal = str(destination).replace("'", "''")
            connection.execute(text(f"VACUUM INTO '{literal}'"))
    finally:
        engine.dispose()
    return BackupResult(
        path=destination, size_bytes=destination.stat().st_size, taken_at=now_instant()
    )


def verify_backup(path: Path) -> int:
    """Open a backup and count what is in it.

    A backup nobody has opened is a file, not a backup. This is the cheapest possible version of
    opening it, and it runs as part of taking one.
    """
    if not path.exists():
        raise InvalidRequestError(f"There is no backup at {path}.")
    settings = Settings(data_dir=path.parent, database_path=path)
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            integrity = connection.execute(text("PRAGMA integrity_check")).scalar_one()
            if integrity != "ok":
                raise InvalidRequestError(f"{path.name} is not a healthy database: {integrity}")
            return int(connection.execute(text("SELECT count(*) FROM audio")).scalar_one())
    finally:
        engine.dispose()


def storage_note(settings: Settings) -> str:
    """What a file-level backup has to cover as well, in words an operator can act on."""
    return (
        f"The originals are not in this backup. Copy {settings.resolved_storage_dir} with a "
        "file-level tool -- they never change once written, so an incremental copy is cheap and "
        "a second full copy is waste. A database backup without them restores an archive that "
        "knows about recordings it does not have, which 'sonarium fsck' will tell you about."
    )
