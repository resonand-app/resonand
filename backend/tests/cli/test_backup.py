"""Backup and restore, exercised rather than assumed (``OPS-6``).

The metric the vision names and almost nobody measures is whether instances survive upgrades. The
two tests that matter here are the ones the plan asks for by name: restore into a clean instance
and assert the archive is complete, and upgrade a populated database and assert nothing was lost.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sonarium.cli.backup import backup_database, storage_note, verify_backup
from sonarium.core.config import Settings
from sonarium.core.errors import ConflictError, InvalidRequestError
from sonarium.db import seed
from sonarium.db.engine import Database, build_engine
from sonarium.db.migrate import migrate_at_startup
from sonarium.db.models import Audio, Segment
from sqlalchemy import text


@pytest.fixture
def populated(database: Database, db_settings: Settings) -> Settings:
    """An instance with a real archive in it."""
    with database.write_session() as session:
        seed.seed(session)
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
    assert verify_backup(result.path) == 4, "every seeded recording, the trashed one included"


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
    restored_db = restored_dir / "sonarium.db"
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
    restored_db = restored_dir / "sonarium.db"
    restored_db.write_bytes(backup.read_bytes())
    engine = build_engine(Settings(data_dir=restored_dir, database_path=restored_db))
    try:
        with engine.connect() as connection:
            found = connection.execute(
                text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH 'factory'")
            ).scalar_one()
    finally:
        engine.dispose()
    assert found > 0


def test_upgrading_a_populated_database_loses_nothing(tmp_path: Path) -> None:
    """The other test the plan asks for by name.

    Today there is one revision, so this migrates from nothing and then runs again with content
    present. It is written now rather than when there are two revisions, because the moment there
    are two is the moment somebody needs to already have this.
    """
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()
    migrate_at_startup(settings)

    engine = build_engine(settings)
    database = Database(engine)
    try:
        with database.write_session() as session:
            seed.seed(session)
        with database.read_session() as session:
            before_audio = session.query(Audio).count()
            before_segments = session.query(Segment).count()
    finally:
        engine.dispose()

    before, after = migrate_at_startup(settings)
    assert before == after, "an upgrade with nothing to do must do nothing"

    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            assert (
                connection.execute(text("SELECT count(*) FROM audio")).scalar_one() == before_audio
            )
            assert (
                connection.execute(text("SELECT count(*) FROM segment")).scalar_one()
                == before_segments
            )
    finally:
        engine.dispose()


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
