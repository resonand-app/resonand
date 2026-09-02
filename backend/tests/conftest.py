"""Database fixtures, and nothing else.

The root ``conftest.py`` is shared by every area of the test suite, so it carries only what every
area could plausibly need: a migrated temporary database and the session factory over it. Media,
transcription and API fixtures belong in ``tests/<area>/conftest.py``, where the area that owns
them can change them without touching anybody else's tests.

The database is a real file rather than ``:memory:``. It costs a few milliseconds and it is the
only way the pragmas, WAL and the write serialisation are exercised as they will run in
production.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from sonarium.core.config import Settings
from sonarium.db.engine import Database, build_engine
from sonarium.db.migrate import upgrade_to_head
from sqlalchemy import Engine


@pytest.fixture
def db_settings(tmp_path: Path) -> Settings:
    """Settings pointing at a database of this test's own.

    ``database_path`` is given explicitly rather than derived, so a ``SONARIUM_DATABASE_PATH``
    left in the developer's environment cannot redirect a test at a real archive.
    """
    return Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")


@pytest.fixture
def db_engine(db_settings: Settings) -> Iterator[Engine]:
    """An engine on an empty database, migrated to head."""
    engine = build_engine(db_settings)
    upgrade_to_head(engine)
    try:
        yield engine
    finally:
        engine.dispose()


@pytest.fixture
def database(db_engine: Engine) -> Database:
    """The session factory: ``database.read_session()`` and ``database.write_session()``."""
    return Database(db_engine)
