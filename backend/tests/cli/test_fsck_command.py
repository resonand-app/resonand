"""The ``sonarium fsck`` command itself (``ING-13``).

``integrity.check`` is covered from every angle in ``test_integrity.py``, and the command around it
was covered from none -- so **the one part an operator actually depends on was the one part nobody
had run**. A cron entry does not read the summary; it reads the exit code, and an `fsck` that found
a truncated recording and exited 0 would be worse than no `fsck` at all, because somebody would
have stopped worrying.

These go through the Typer runner rather than calling ``check`` again: the point is the wiring --
the settings, the read session, the output, and the exit code on the way out.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import TYPE_CHECKING

import pytest
from sonarium.cli.main import app
from sonarium.core.config import reset_settings_cache
from sonarium.db import libraries, users
from sonarium.db.audio import create_audio
from sonarium.media import storage
from typer.testing import CliRunner

if TYPE_CHECKING:
    from sonarium.core.config import Settings
    from sonarium.db.engine import Database

runner = CliRunner()


@pytest.fixture
def archive_env(
    database: Database, db_settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> Iterator[str]:
    """One stored recording, and the environment the command reads its settings from."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="",
            original_filename="note.m4a",
        )
        path, digest = storage.store_original(
            db_settings.resolved_storage_dir,
            audio.uuid,
            [b"the original bytes"],
            filename="note.m4a",
        )
        audio.storage_path = storage.relative(db_settings.resolved_storage_dir, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        uuid = audio.uuid

    monkeypatch.setenv("SONARIUM_DATA_DIR", str(db_settings.data_dir))
    monkeypatch.setenv("SONARIUM_DATABASE_PATH", str(db_settings.resolved_database_path))
    monkeypatch.setenv("SONARIUM_SECRET_KEY", "0" * 64)
    reset_settings_cache()
    yield uuid
    reset_settings_cache()


def test_a_clean_archive_exits_zero(archive_env: str) -> None:
    result = runner.invoke(app, ["fsck"])
    assert result.exit_code == 0, result.output
    assert "all present and unchanged" in result.output


def test_a_changed_file_exits_non_zero(archive_env: str, db_settings: Settings) -> None:
    """The exit code is the whole contract. A cron job never reads the summary."""
    stored = storage.stored_files(db_settings.resolved_storage_dir)[0]
    stored.write_bytes(b"something else entirely")

    result = runner.invoke(app, ["fsck"])
    assert result.exit_code == 1, result.output
    assert "changed" in result.output


def test_a_missing_file_exits_non_zero(archive_env: str, db_settings: Settings) -> None:
    storage.stored_files(db_settings.resolved_storage_dir)[0].unlink()
    result = runner.invoke(app, ["fsck"])
    assert result.exit_code == 1, result.output


def test_the_fast_check_skips_hashing_and_still_exits_zero(archive_env: str) -> None:
    result = runner.invoke(app, ["fsck", "--fast"])
    assert result.exit_code == 0, result.output


def test_the_fast_check_does_not_notice_a_changed_file(
    archive_env: str, db_settings: Settings
) -> None:
    """Stated rather than assumed: `--fast` answers a different question, and an operator who
    cronned it thinking otherwise would be checking nothing."""
    storage.stored_files(db_settings.resolved_storage_dir)[0].write_bytes(b"something else")
    assert runner.invoke(app, ["fsck", "--fast"]).exit_code == 0


def test_json_output_is_machine_readable_and_still_exits_non_zero(
    archive_env: str, db_settings: Settings
) -> None:
    storage.stored_files(db_settings.resolved_storage_dir)[0].unlink()
    result = runner.invoke(app, ["fsck", "--json"])
    assert result.exit_code == 1
    reported = json.loads(result.stdout)
    assert reported["clean"] is False
    assert [finding["kind"] for finding in reported["findings"]] == ["missing"]
    assert reported["findings"][0]["uuid"] == archive_env


def test_a_fragment_left_by_a_killed_process_exits_non_zero(
    archive_env: str, db_settings: Settings
) -> None:
    directory = storage.recording_dir(db_settings.resolved_storage_dir, archive_env)
    (directory / ".derived.opus.partial").write_bytes(b"half a derivative")
    result = runner.invoke(app, ["fsck"])
    assert result.exit_code == 1, result.output
    assert "left behind" in result.output
