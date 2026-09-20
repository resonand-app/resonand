"""``sonarium create-admin`` (``OPS-6``).

The command existed for the case first run does not cover -- an instance whose only administrator
is locked out -- and was covered by nothing. It is also the first half of getting a recording into
a fresh container from the command line, which is how the restore in CI's ``image`` job starts, so
what it prints is now something another program reads.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest
from sonarium.cli.main import app
from sonarium.core.config import reset_settings_cache
from sonarium.db import users
from typer.testing import CliRunner

if TYPE_CHECKING:
    from sonarium.core.config import Settings
    from sonarium.db.engine import Database

runner = CliRunner()


@pytest.fixture
def instance_env(
    database: Database, db_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Database]:
    """An empty instance, and the environment the command reads its settings from."""
    monkeypatch.setenv("SONARIUM_DATA_DIR", str(db_settings.data_dir))
    monkeypatch.setenv("SONARIUM_DATABASE_PATH", str(db_settings.resolved_database_path))
    monkeypatch.setenv("SONARIUM_SECRET_KEY", "0" * 64)
    reset_settings_cache()
    yield database
    reset_settings_cache()


def test_an_administrator_is_created(instance_env: Database) -> None:
    result = runner.invoke(
        app,
        ["create-admin", "--email", "a@x.test", "--display-name", "A", "--password", "a-password"],
    )
    assert result.exit_code == 0, result.output
    with instance_env.read_session() as session:
        created = users.find_by_email(session, "a@x.test")
    assert created is not None
    assert created.is_admin


def test_it_says_which_library_to_import_into(instance_env: Database) -> None:
    """The uuid is what `sonarium import --library` takes, and an account that has just been
    created from a terminal has no other way to learn it."""
    result = runner.invoke(
        app,
        ["create-admin", "--email", "b@x.test", "--display-name", "B", "--password", "b-password"],
    )
    assert result.exit_code == 0, result.output
    with instance_env.read_session() as session:
        created = users.find_by_email(session, "b@x.test")
        assert created is not None
        expected = users.personal_library(session, created.id).uuid
    assert f"Personal library: {expected}" in result.output
