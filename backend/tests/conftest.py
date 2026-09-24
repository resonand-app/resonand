"""Database fixtures, and the price of a password.

The root ``conftest.py`` is shared by every area of the test suite, so it carries only what every
area could plausibly need: a migrated temporary database and the session factory over it, and the
one production cost no test should pay. Media, transcription and API fixtures belong in
``tests/<area>/conftest.py``, where the area that owns them can change them without touching
anybody else's tests.

The database is a real file rather than ``:memory:``. It costs a few milliseconds and it is the
only way the pragmas, WAL and the write serialisation are exercised as they will run in
production.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from pathlib import Path

import pytest
from argon2 import PasswordHasher, profiles
from resonand.api import security
from resonand.core.config import Settings
from resonand.db.engine import Database, build_engine
from resonand.db.migrate import upgrade_to_head
from sqlalchemy import Engine


@pytest.fixture(autouse=True, scope="session")
def passwords_at_test_strength() -> Iterator[None]:
    """Argon2 at the cheapest parameters argon2-cffi has, for the whole session (``INF-18``).

    Production's parameters make a guess cost ~50 ms, which is their whole point there and was
    half of this suite's time here: the API fixtures hash three passwords a test and every sign-in
    verifies one. The hash an unknown address is checked against goes too, or refusing one would
    still cost production's price. ``tests/api/test_security.py`` pins what production uses.
    """
    cheap = PasswordHasher.from_parameters(profiles.CHEAPEST)
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(security, "_hasher", cheap)
        patch.setattr(
            security, "_NO_ACCOUNT", cheap.hash(secrets.token_urlsafe(security.TOKEN_BYTES))
        )
        yield


@pytest.fixture
def db_settings(tmp_path: Path) -> Settings:
    """Settings pointing at a database of this test's own.

    ``database_path`` is given explicitly rather than derived, so a ``RESONAND_DATABASE_PATH``
    left in the developer's environment cannot redirect a test at a real archive.
    """
    return Settings(data_dir=tmp_path, database_path=tmp_path / "resonand.db")


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
