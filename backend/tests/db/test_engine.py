"""The connection layer (``DAT-2``): pragmas in force, and one writer at a time."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from resonand.core.config import Settings
from resonand.db.engine import Database, build_engine
from resonand.db.migrate import upgrade_to_head
from sqlalchemy import Engine, text
from sqlalchemy.exc import OperationalError

from tests.db.rows import insert_library, insert_user

WRITERS = 24
"""Enough threads to contend for real. The point is not the number, it is that it is above one."""


@pytest.mark.parametrize(
    ("pragma", "expected"),
    [
        ("journal_mode", "wal"),
        ("foreign_keys", 1),
        ("synchronous", 1),
    ],
)
def test_every_connection_arrives_configured(
    db_engine: Engine, pragma: str, expected: object
) -> None:
    """foreign_keys is per connection in SQLite: a pooled one that escaped would silently
    accept a category from another library."""
    with db_engine.connect() as connection:
        assert connection.execute(text(f"PRAGMA {pragma}")).scalar_one() == expected


def test_a_second_connection_is_configured_too(db_engine: Engine) -> None:
    with db_engine.connect() as first, db_engine.connect() as second:
        assert first.execute(text("PRAGMA foreign_keys")).scalar_one() == 1
        assert second.execute(text("PRAGMA foreign_keys")).scalar_one() == 1


def test_simultaneous_writers_never_see_the_database_locked(database: Database) -> None:
    """The load test DAT-2 asks for.

    SQLite allows one writer at a time. Serialising them in-process is what turns that from an
    error the caller has to retry into a wait nobody notices -- and busy_timeout alone does not,
    because under contention it eventually gives up and raises SQLITE_BUSY.
    """
    with database.write_session() as session:
        owner = insert_user(session.connection())
    ready = threading.Barrier(WRITERS)
    failures: list[BaseException] = []

    def write(index: int) -> None:
        ready.wait(timeout=10)
        try:
            with database.write_session() as session:
                insert_library(session.connection(), owner, name=f"Library {index}")
        except BaseException as error:
            failures.append(error)

    with ThreadPoolExecutor(max_workers=WRITERS) as pool:
        list(pool.map(write, range(WRITERS)))

    assert not [f for f in failures if isinstance(f, OperationalError)], "a writer got SQLITE_BUSY"
    assert not failures
    with database.read_session() as session:
        landed = session.execute(text("SELECT count(*) FROM library")).scalar_one()
    assert landed == WRITERS, "every write has to land, not merely not fail"


def test_reads_run_while_a_write_is_in_flight(database: Database) -> None:
    """WAL's whole point: a reader never blocks a writer and a writer never blocks a reader."""
    with database.write_session() as session:
        owner = insert_user(session.connection())
    with database.write_session() as write, database.read_session() as read:
        insert_library(write.connection(), owner, name="In flight")
        assert read.execute(text("SELECT count(*) FROM library")).scalar_one() == 0


def test_a_failed_write_leaves_nothing_behind(database: Database) -> None:
    with database.write_session() as session:
        owner = insert_user(session.connection())
    with pytest.raises(RuntimeError), database.write_session() as session:
        insert_library(session.connection(), owner, name="Doomed")
        raise RuntimeError("something went wrong halfway through")
    with database.read_session() as session:
        assert session.execute(text("SELECT count(*) FROM library")).scalar_one() == 0


def test_a_failed_write_releases_the_lock(database: Database) -> None:
    """A lock held by a crashed writer would wedge the whole process, silently."""
    with pytest.raises(RuntimeError), database.write_session():
        raise RuntimeError("boom")
    with database.write_session() as session:
        assert session.execute(text("SELECT 1")).scalar_one() == 1


def test_an_in_memory_database_works_for_tests_that_want_one(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, database_path=Path(":memory:"))
    engine = build_engine(settings)
    try:
        upgrade_to_head(engine)
        with engine.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM user")).scalar_one() == 0
    finally:
        engine.dispose()
