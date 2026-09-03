"""Migrations at startup, under a lock (``OPS-7``).

Principle 5 is that an archive does not break, and the ordinary way to upgrade should be to pull
a new image and restart. That only works if the instance migrates itself -- and if two of them
coming up together cannot both do it.
"""

from __future__ import annotations

import fcntl
import multiprocessing
import os
import time
from multiprocessing.process import BaseProcess
from pathlib import Path

import pytest
from sonarium.core.config import Settings
from sonarium.core.errors import ConfigurationError
from sonarium.db.engine import build_engine
from sonarium.db.migrate import (
    LOCK_NAME,
    migrate_at_startup,
    migration_lock,
    revisions,
    upgrade_to_head,
)
from sqlalchemy import text


def test_a_fresh_instance_migrates_itself(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    before, after = migrate_at_startup(settings)
    assert before is None, "there was no schema"
    assert after is not None, "and now there is"


def test_starting_again_changes_nothing(tmp_path: Path) -> None:
    """A restart is not an upgrade, and must not be logged as one."""
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    migrate_at_startup(settings)
    before, after = migrate_at_startup(settings)
    assert before == after


def test_an_upgraded_instance_can_say_where_it_is_and_where_it_should_be(tmp_path: Path) -> None:
    """The pair is what tells an operator whether to roll the image back or the database
    forward."""
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    engine = build_engine(settings)
    try:
        current, head = revisions(engine)
        assert current is None
        assert head is not None
        upgrade_to_head(engine)
        current, head = revisions(engine)
        assert current == head
    finally:
        engine.dispose()


def test_the_migration_actually_produced_the_schema(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    migrate_at_startup(settings)
    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT count(*) FROM audio")).scalar_one() == 0
    finally:
        engine.dispose()


def test_the_lock_is_a_file_beside_the_database(tmp_path: Path) -> None:
    """A file lock rather than a thread lock, because the thing being guarded against is a second
    process -- an overlapping restart, or somebody running the command by hand."""
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    with migration_lock(settings):
        assert (tmp_path / LOCK_NAME).exists()


def test_a_second_holder_waits_rather_than_failing(tmp_path: Path) -> None:
    """Two containers coming up together is an ordinary event. The second should start a moment
    later, not exit and be restarted by whatever is watching it."""
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    started = time.monotonic()
    with _holding_the_lock(tmp_path, hold_for=0.5), migration_lock(settings, timeout_seconds=10):
        waited = time.monotonic() - started
    assert waited >= 0.4, "it waited for the other process instead of proceeding alongside it"


def test_waiting_forever_is_not_an_option(tmp_path: Path) -> None:
    """A stuck lock has to say which file to delete, or an instance is simply down."""
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    with (
        _holding_the_lock(tmp_path, hold_for=3.0),
        pytest.raises(ConfigurationError) as raised,
        migration_lock(settings, timeout_seconds=0.5),
    ):
        pass
    assert LOCK_NAME in str(raised.value)
    assert "delete that file" in str(raised.value)


def test_an_in_memory_database_needs_no_lock(tmp_path: Path) -> None:
    """Nowhere to put a lock file, and no second process to race."""
    settings = Settings(data_dir=tmp_path, database_path=Path(":memory:"))
    with migration_lock(settings):
        assert not (tmp_path / LOCK_NAME).exists()


def _hold(path: str, seconds: float) -> None:  # pragma: no cover -- runs in a child process
    handle = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    fcntl.flock(handle, fcntl.LOCK_EX)
    time.sleep(seconds)
    fcntl.flock(handle, fcntl.LOCK_UN)
    os.close(handle)


class _holding_the_lock:  # noqa: N801 -- reads as a context manager at the call site
    """Another *process* holding the lock, which is the only honest way to test a file lock."""

    def __init__(self, directory: Path, *, hold_for: float) -> None:
        self._path = str(directory / LOCK_NAME)
        self._hold_for = hold_for
        self._process: BaseProcess | None = None

    def __enter__(self) -> None:
        context = multiprocessing.get_context("spawn")
        process = context.Process(target=_hold, args=(self._path, self._hold_for))
        process.start()
        self._process = process
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline and not _is_locked(self._path):
            time.sleep(0.02)

    def __exit__(self, *_: object) -> None:
        if self._process is not None:
            self._process.join(timeout=10)


def _is_locked(path: str) -> bool:
    handle = os.open(path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(handle, fcntl.LOCK_UN)
        return False
    except BlockingIOError:
        return True
    finally:
        os.close(handle)
