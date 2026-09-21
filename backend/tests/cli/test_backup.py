"""Backup and restore, exercised rather than assumed (``OPS-6``).

The metric the vision names and almost nobody measures is whether instances survive upgrades.
This file holds the backup half: a copy taken from a live database, and a restore that is
performed rather than mocked.

The other half is elsewhere, in two places. ``tests/db/test_upgrading_a_populated_database.py``
walks the revision tree with an archive already in the database; the restore into a clean
*container* is in CI's ``image`` job, because a container is the one thing a test in this process
cannot be.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from resonand.cli.backup import backup_database, storage_note, verify_backup
from resonand.core.config import Settings
from resonand.core.errors import ConflictError, InvalidRequestError
from resonand.db import libraries, transcripts, users
from resonand.db.audio import create_audio, trash_audio
from resonand.db.engine import Database, build_engine
from resonand.db.transcripts import SegmentDraft
from sqlalchemy import text
from sqlalchemy.orm import Session

SEGMENTS = [
    "The first segment of a sample transcript.",
    "The second segment, so a restore that lost one is visible in the count.",
    "The third segment, which is the one the search index is asked for.",
]


def populate(session: Session) -> None:
    """Four recordings, one of them in the trash, and one transcript to index.

    Written out here rather than shared with another test, because what these tests assert is a
    count: a fixture somebody else could grow would make them pass or fail for a reason that is
    not in this file.
    """
    owner = users.create_user(session, email="owner@example.test", display_name="Owner")
    library = libraries.create_library(session, owner.id, name="Recordings")
    made = []
    for index in range(4):
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path=f"storage/aa/{index}/original.m4a",
            original_filename=f"recording-{index}.m4a",
        )
        audio.duration_ms = 60_000 * (index + 1)
        made.append(audio)
    session.flush()
    transcripts.create_transcript(
        session,
        made[0].id,
        [
            SegmentDraft(index * 1000, index * 1000 + 900, line)
            for index, line in enumerate(SEGMENTS)
        ],
    )
    trash_audio(session, owner.id, made[-1].uuid)


@pytest.fixture
def populated(database: Database, db_settings: Settings) -> Settings:
    """An instance with a real archive in it."""
    with database.write_session() as session:
        populate(session)
    return db_settings


def test_a_backup_is_taken_without_stopping_the_service(
    populated: Settings, tmp_path: Path
) -> None:
    """VACUUM INTO asks SQLite for a consistent snapshot from a read transaction. cp does not."""
    result = backup_database(populated, tmp_path / "backup.sqlite")
    assert result.size_bytes > 0
    assert result.taken_at


def test_writes_can_continue_while_a_backup_is_taken(
    populated: Settings, database: Database, tmp_path: Path
) -> None:
    with database.write_session() as session:
        session.execute(text("UPDATE audio SET title = 'changed during the backup'"))
    result = backup_database(populated, tmp_path / "backup.sqlite")
    assert verify_backup(result.path) > 0


def test_a_backup_is_never_overwritten(populated: Settings, tmp_path: Path) -> None:
    """A command that silently replaced yesterday's copy would turn one bad night into no
    history at all."""
    destination = tmp_path / "backup.sqlite"
    backup_database(populated, destination)
    with pytest.raises(ConflictError, match="never overwritten"):
        backup_database(populated, destination)


def test_a_backup_is_opened_as_part_of_being_taken(populated: Settings, tmp_path: Path) -> None:
    """A backup nobody has opened is a file, not a backup."""
    result = backup_database(populated, tmp_path / "backup.sqlite")
    assert verify_backup(result.path) == 4, "every recording, the trashed one included"


def test_a_corrupt_backup_is_not_reported_as_a_backup(tmp_path: Path) -> None:
    broken = tmp_path / "broken.sqlite"
    broken.write_bytes(b"this is not a database")
    with pytest.raises((InvalidRequestError, Exception)):
        verify_backup(broken)


def test_a_backup_that_is_not_there_says_so(tmp_path: Path) -> None:
    with pytest.raises(InvalidRequestError, match="no backup at"):
        verify_backup(tmp_path / "absent.sqlite")


def test_restoring_into_a_clean_instance_gives_back_the_whole_archive(
    populated: Settings, database: Database, tmp_path: Path
) -> None:
    """The restore the plan asks for by name. Done for real, not mocked: the backup file becomes
    a second instance's database, and it is asked what it contains."""
    with database.read_session() as session:
        expected_titles = sorted(
            row.title for row in session.execute(text("SELECT title FROM audio")).all()
        )
        expected_segments = session.execute(text("SELECT count(*) FROM segment")).scalar_one()

    backup = backup_database(populated, tmp_path / "backup.sqlite").path

    restored_dir = tmp_path / "restored"
    restored_dir.mkdir()
    restored_db = restored_dir / "resonand.db"
    restored_db.write_bytes(backup.read_bytes())

    restored_settings = Settings(data_dir=restored_dir, database_path=restored_db)
    engine = build_engine(restored_settings)
    try:
        with engine.connect() as connection:
            titles = sorted(
                row.title for row in connection.execute(text("SELECT title FROM audio")).all()
            )
            segments = connection.execute(text("SELECT count(*) FROM segment")).scalar_one()
    finally:
        engine.dispose()

    assert titles == expected_titles
    assert segments == expected_segments
    assert segments > 0, "a restore that brought back no transcripts would pass a count of zero"


def test_the_search_index_survives_a_restore(populated: Settings, tmp_path: Path) -> None:
    """FTS5 lives in the same file, so it should -- but a restore that lost it would look fine
    until somebody searched."""
    backup = backup_database(populated, tmp_path / "backup.sqlite").path
    restored_dir = tmp_path / "restored"
    restored_dir.mkdir()
    restored_db = restored_dir / "resonand.db"
    restored_db.write_bytes(backup.read_bytes())
    engine = build_engine(Settings(data_dir=restored_dir, database_path=restored_db))
    try:
        with engine.connect() as connection:
            found = connection.execute(
                text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH 'segment'")
            ).scalar_one()
    finally:
        engine.dispose()
    assert found > 0


def test_the_operator_is_told_what_the_backup_does_not_cover(populated: Settings) -> None:
    """A database backup without the originals restores an archive that knows about recordings it
    does not have."""
    note = storage_note(populated)
    assert str(populated.resolved_storage_dir) in note
    assert "fsck" in note


def test_an_in_memory_database_has_nothing_to_back_up(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path, database_path=Path(":memory:"))
    with pytest.raises(InvalidRequestError, match="nothing to back up"):
        backup_database(settings, tmp_path / "backup.sqlite")
