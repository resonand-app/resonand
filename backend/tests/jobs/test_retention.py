"""The retention purge (``INT-2``).

This is the only place in the application that removes a file from storage. Everything else that
deletes sets ``deleted_at`` and touches no bytes, which is what makes a restore instant -- and
what makes this the one handler where a bug loses somebody's recording rather than inconveniencing
them.
"""

from __future__ import annotations

from datetime import timedelta

from resonand.core.config import Settings
from resonand.core.time import instant_after, utc_now
from resonand.db import libraries, users
from resonand.db import sessions as session_repo
from resonand.db.audio import create_audio, trash_audio
from resonand.db.engine import Database
from resonand.db.models import Audio, Library
from resonand.jobs.handlers import Context
from resonand.jobs.worker import Worker
from resonand.media import storage
from sqlalchemy import select, text


def _trashed(
    database: Database,
    settings: Settings,
    *,
    days_ago: int,
    title: str = "Old note",
    trash_the_recording: bool = True,
) -> str:
    """A recording with a real file on disk, sent to the trash a given number of days ago.

    ``trash_the_recording=False`` leaves it where it is, which is the state a recording is in when
    the library around it was trashed instead: the row is untouched and carries no expiry.
    """
    with database.write_session() as session:
        user = users.find_by_email(session, "o@x.test")
        if user is None:
            user = users.create_user(session, email="o@x.test", display_name="O")
            libraries.create_library(session, user.id, name="Family")
        library = libraries.list_libraries(session, user.id)[1][0]
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=user.id,
            storage_path="",
            original_filename=f"{title}.m4a",
            title=title,
        )
        path, digest = storage.store_original(
            settings.resolved_storage_dir, audio.uuid, [b"bytes"], filename=f"{title}.m4a"
        )
        audio.storage_path = storage.relative(settings.resolved_storage_dir, path)
        audio.sha256 = digest.sha256
        session.flush()
        if trash_the_recording:
            trash_audio(session, user.id, audio.uuid)
            audio.deleted_at = instant_after(timedelta(days=-days_ago), since=utc_now())
            session.flush()
        return audio.uuid


def _purge(database: Database, settings: Settings) -> None:
    worker = Worker(Context(database=database, settings=settings))
    assert worker.schedule_maintenance() is True
    assert worker.run_once() is True
    assert worker.stats.failed == 0


def test_something_past_its_retention_is_removed_row_and_file(
    database: Database, db_settings: Settings
) -> None:
    uuid = _trashed(database, db_settings, days_ago=40)
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is None
    assert not storage.recording_dir(db_settings.resolved_storage_dir, uuid).exists()


def test_something_still_inside_its_retention_is_left_alone(
    database: Database, db_settings: Settings
) -> None:
    """Thirty days is the default, and the whole point of a trash is the days before it runs."""
    uuid = _trashed(database, db_settings, days_ago=5)
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is not None
    assert storage.recording_dir(db_settings.resolved_storage_dir, uuid).exists()


def test_the_retention_period_is_configurable_per_instance(
    database: Database, db_settings: Settings
) -> None:
    """DEC-3: per instance, never per library."""
    uuid = _trashed(database, db_settings, days_ago=10)
    shorter = db_settings.model_copy(update={"trash_retention_days": 7})
    _purge(database, shorter)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is None


def test_a_recording_that_was_never_trashed_is_untouchable(
    database: Database, db_settings: Settings
) -> None:
    uuid = _trashed(database, db_settings, days_ago=40, title="Old note")
    with database.write_session() as session:
        keep = create_audio(
            session,
            library_id=1,
            uploaded_by=1,
            storage_path="aa/keep/original.m4a",
            original_filename="keep.m4a",
            title="Still here",
        )
        kept_uuid = keep.uuid
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == kept_uuid)).first() is not None
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is None


def test_a_purged_recording_leaves_the_search_index(
    database: Database, db_settings: Settings
) -> None:
    _trashed(database, db_settings, days_ago=40, title="Grandmother")
    _purge(database, db_settings)
    with database.read_session() as session:
        found = session.execute(
            text("SELECT count(*) FROM audio_fts WHERE audio_fts MATCH 'grandmother'")
        ).scalar_one()
    assert found == 0


def test_an_empty_expired_library_is_removed(database: Database, db_settings: Settings) -> None:
    with database.write_session() as session:
        user = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, user.id, name="Gone")
        library.deleted_at = instant_after(timedelta(days=-40), since=utc_now())
        uuid = library.uuid
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Library).where(Library.uuid == uuid)).first() is None


def test_a_trashed_library_takes_its_untrashed_recordings_with_it(
    database: Database, db_settings: Settings
) -> None:
    """Trashing a library sets one ``deleted_at`` and touches no recording rows, so nothing inside
    one carries an expiry of its own. Matching only on the recording's own ``deleted_at`` left the
    library holding rows for ever, and ``INT-1`` counted down to a purge that could not arrive."""
    uuid = _trashed(database, db_settings, days_ago=40, trash_the_recording=False)
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.is_personal == 0)).scalar_one()
        library.deleted_at = instant_after(timedelta(days=-40), since=utc_now())
        library_uuid = library.uuid
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is None
        assert session.execute(select(Library).where(Library.uuid == library_uuid)).first() is None
    assert not storage.recording_dir(db_settings.resolved_storage_dir, uuid).exists()


def test_a_library_inside_its_retention_keeps_everything_in_it(
    database: Database, db_settings: Settings
) -> None:
    """The days before it runs are the whole point of a trash, and trashing a library is the one
    gesture that puts a recording somebody never trashed on a countdown."""
    uuid = _trashed(database, db_settings, days_ago=40, trash_the_recording=False)
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.is_personal == 0)).scalar_one()
        library.deleted_at = instant_after(timedelta(days=-5), since=utc_now())
        library_uuid = library.uuid
    _purge(database, db_settings)
    with database.read_session() as session:
        assert session.execute(select(Audio).where(Audio.uuid == uuid)).first() is not None
        assert (
            session.execute(select(Library).where(Library.uuid == library_uuid)).first() is not None
        )


def test_the_purge_is_scheduled_once_a_day_and_not_once_a_tick(
    database: Database, db_settings: Settings
) -> None:
    """The idempotency key carries the date, which is the entire scheduler: no cron, no timer,
    and it survives a restart."""
    worker = Worker(Context(database=database, settings=db_settings))
    assert worker.schedule_maintenance() is True
    assert worker.schedule_maintenance() is False
    assert worker.schedule_maintenance() is False


def test_an_instance_switched_off_for_a_week_purges_once_when_it_returns(
    database: Database, db_settings: Settings
) -> None:
    _trashed(database, db_settings, days_ago=40)
    _purge(database, db_settings)
    worker = Worker(Context(database=database, settings=db_settings))
    assert worker.schedule_maintenance() is False, "not seven times"


def test_a_purge_with_nothing_to_do_is_not_a_failure(
    database: Database, db_settings: Settings
) -> None:
    _purge(database, db_settings)


def test_expired_sessions_are_swept_up_at_the_same_time(
    database: Database, db_settings: Settings
) -> None:
    with database.write_session() as session:
        user = users.create_user(session, email="o@x.test", display_name="O")
        row, _ = session_repo.create_session(session, user.id, ttl_days=1)
        row.expires_at = instant_after(timedelta(days=-2), since=utc_now())
        session_id = row.id
    _purge(database, db_settings)
    with database.read_session() as session:
        listed = session_repo.list_sessions(session, 1)
    assert next(row for row in listed if row.id == session_id).revoked_at is not None
