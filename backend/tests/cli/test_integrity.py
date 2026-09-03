"""``sonarium fsck`` (``ING-13``).

Principle 5 made checkable. The stated worst outcome for this project is shipping something that
loses files, and ``sha256`` is written once at ingestion and otherwise never looked at again --
so without this, a backup that has been silently restoring truncated files for six months would
go unnoticed until somebody opened one.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sonarium.cli.integrity import CHANGED, MISSING, ORPHAN, check
from sonarium.core.config import Settings
from sonarium.db import libraries, users
from sonarium.db.audio import create_audio, trash_audio
from sonarium.db.engine import Database
from sonarium.media import storage


@pytest.fixture
def archive(database: Database, db_settings: Settings) -> str:
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
        session.flush()
        return audio.uuid


def test_an_intact_archive_is_clean(
    database: Database, db_settings: Settings, archive: str
) -> None:
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert report.is_clean
    assert report.checked == 1
    assert "all present and unchanged" in report.summary()


def test_a_missing_file_is_found(database: Database, db_settings: Settings, archive: str) -> None:
    storage.find_original(db_settings.resolved_storage_dir, archive).unlink()
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert [finding.kind for finding in report.findings] == [MISSING]
    assert report.findings[0].uuid == archive


def test_a_file_that_has_changed_since_ingestion_is_found(
    database: Database, db_settings: Settings, archive: str
) -> None:
    """Bit rot, a bad restore, a half-finished copy. Nothing else in the archive would notice."""
    path = storage.find_original(db_settings.resolved_storage_dir, archive)
    path.write_bytes(b"the original bytes, tampered with")
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert [finding.kind for finding in report.findings] == [CHANGED]
    assert "has changed since it was ingested" in report.findings[0].detail


def test_a_truncated_file_is_found(database: Database, db_settings: Settings, archive: str) -> None:
    path = storage.find_original(db_settings.resolved_storage_dir, archive)
    path.write_bytes(b"the original")
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert report.findings[0].kind == CHANGED


def test_a_file_no_recording_points_at_is_found(
    database: Database, db_settings: Settings, archive: str
) -> None:
    """Not dangerous, but it is how a disk fills up with things nobody can find."""
    storage.store_original(
        db_settings.resolved_storage_dir,
        "11111111-1111-4111-8111-111111111111",
        [b"left over"],
        filename="orphan.m4a",
    )
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert [finding.kind for finding in report.findings] == [ORPHAN]


def test_the_fast_check_still_notices_a_missing_file(
    database: Database, db_settings: Settings, archive: str
) -> None:
    storage.find_original(db_settings.resolved_storage_dir, archive).unlink()
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir, verify_hashes=False)
    assert not report.is_clean
    assert report.bytes_read == 0


def test_the_fast_check_does_not_notice_a_changed_one(
    database: Database, db_settings: Settings, archive: str
) -> None:
    """Worth stating: --fast answers a different question, and the summary must not imply
    otherwise to somebody running it nightly."""
    storage.find_original(db_settings.resolved_storage_dir, archive).write_bytes(b"different")
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir, verify_hashes=False)
    assert report.is_clean


def test_trashed_recordings_are_checked_too(
    database: Database, db_settings: Settings, archive: str
) -> None:
    """They are still the user's files until retention takes them, and a restore that produces a
    missing file is worse than one that never happened."""
    with database.write_session() as session:
        trash_audio(session, 1, archive)
    storage.find_original(db_settings.resolved_storage_dir, archive).unlink()
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert not report.is_clean


def test_an_empty_archive_is_clean(database: Database, db_settings: Settings) -> None:
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    assert report.is_clean
    assert report.checked == 0


def test_the_summary_counts_each_kind_of_problem(
    database: Database, db_settings: Settings, archive: str, tmp_path: Path
) -> None:
    storage.find_original(db_settings.resolved_storage_dir, archive).unlink()
    storage.store_original(
        db_settings.resolved_storage_dir,
        "11111111-1111-4111-8111-111111111111",
        [b"left over"],
        filename="orphan.m4a",
    )
    with database.read_session() as session:
        report = check(session, db_settings.resolved_storage_dir)
    summary = report.summary()
    assert "1 missing" in summary
    assert "1 orphan" in summary
