"""The job queue (``JOB-1``)."""

from __future__ import annotations

from datetime import timedelta

import pytest
from sonarium.core.time import instant_after, now_instant
from sonarium.db import libraries, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Job
from sonarium.jobs import queue
from sqlalchemy import select, update


def _audio(database: Database) -> int:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        return audio.id


def test_work_comes_back_in_the_order_it_was_added(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id, idempotency_key="a")
        queue.enqueue(session, "waveform", audio_id=audio_id, idempotency_key="b")
    with database.write_session() as session:
        first = queue.claim(session)
        second = queue.claim(session)
    assert first is not None
    assert second is not None
    assert (first.kind, second.kind) == ("probe", "waveform")


def test_the_same_work_is_not_queued_twice(database: Database) -> None:
    """A retried upload, a re-run of the watch folder and a second click all arrive here."""
    audio_id = _audio(database)
    with database.write_session() as session:
        assert queue.enqueue(session, "probe", audio_id=audio_id, idempotency_key="probe:1")
        assert queue.enqueue(session, "probe", audio_id=audio_id, idempotency_key="probe:1") is None
    with database.read_session() as session:
        assert len(session.execute(select(Job)).scalars().all()) == 1


def test_an_empty_queue_hands_out_nothing(database: Database) -> None:
    with database.write_session() as session:
        assert queue.claim(session) is None


def test_a_claimed_job_is_not_handed_out_again(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
    with database.write_session() as session:
        assert queue.claim(session) is not None
        assert queue.claim(session) is None


def test_claiming_counts_the_attempt(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
    with database.write_session() as session:
        work = queue.claim(session)
    assert work is not None
    assert work.attempts == 1


def test_a_failure_goes_back_on_the_queue_until_it_has_been_tried_enough(
    database: Database,
) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        assert queue.fail(session, 1, "whisper is down", attempts=1) == queue.PENDING
        assert (
            queue.fail(session, 1, "whisper is down", attempts=queue.MAX_ATTEMPTS) == queue.FAILED
        )


def test_a_failed_job_waits_before_it_is_tried_again(database: Database) -> None:
    """Retrying a service that is down, immediately and forever, is how you get rate limited."""
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "not yet", attempts=work.attempts)
    with database.write_session() as session:
        assert queue.claim(session) is None, "the backoff has not elapsed"


def test_once_the_backoff_has_elapsed_it_is_tried_again(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "not yet", attempts=work.attempts)
        long_ago = instant_after(timedelta(seconds=-queue.MAX_BACKOFF_SECONDS * 2))
        session.execute(update(Job).where(Job.id == work.id).values(finished_at=long_ago))
    with database.write_session() as session:
        assert queue.claim(session) is not None


@pytest.mark.parametrize(
    ("attempts", "at_least"), [(1, 15), (2, 30), (3, 60), (10, queue.MAX_BACKOFF_SECONDS)]
)
def test_the_wait_grows_and_then_stops_growing(attempts: int, at_least: int) -> None:
    """The cap matters more than the curve: a service down for a day should be retried hourly,
    not once more in a fortnight."""
    assert queue.backoff_seconds(attempts) == at_least


def test_a_job_the_process_died_holding_comes_back(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        claimed = queue.claim(session)
    assert claimed is not None
    with database.write_session() as session:
        assert queue.recover_interrupted(session) == 1
        session.execute(update(Job).where(Job.id == claimed.id).values(finished_at=None))
    with database.write_session() as session:
        assert queue.claim(session) is not None


def test_a_recovered_job_keeps_its_attempt_so_a_poison_job_eventually_stops(
    database: Database,
) -> None:
    """A job that reliably kills the process would otherwise be picked up forever."""
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        claimed = queue.claim(session)
        assert claimed is not None
        queue.recover_interrupted(session)
        row = session.get(Job, claimed.id)
    assert row is not None
    assert row.attempts == 1


def test_a_cancelled_job_is_not_run(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        assert queue.cancel(session, job.id) is True
        assert queue.claim(session) is None


def test_finishing_a_job_cancelled_under_it_does_not_undo_the_cancellation(
    database: Database,
) -> None:
    """A running handler is not killed, so it returns the same way either way (``API-21``).

    Without this the row would come back as ``done`` seconds after somebody stopped it, which is
    the one outcome cancel must never produce: the work was paid for, the audio was sent, and the
    screen would say it succeeded.
    """
    audio_id = _audio(database)
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        work = queue.claim(session)
        assert work is not None
        assert queue.cancel(session, work.id) is True
        assert queue.finish(session, work.id) is False
        row = session.get(Job, work.id)
    assert row is not None
    assert row.state == queue.CANCELLED


def test_a_job_cancelled_under_it_is_not_put_back_when_it_then_fails(database: Database) -> None:
    """The same rule from the other side: a provider that breaks after the cancellation must not
    restart the work somebody has just stopped."""
    audio_id = _audio(database)
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        work = queue.claim(session)
        assert work is not None
        queue.cancel(session, work.id)
        assert queue.fail(session, work.id, "broke", attempts=work.attempts) == queue.CANCELLED
        assert queue.claim(session) is None


def test_cancelling_a_recordings_transcription_finds_the_one_in_flight(
    database: Database,
) -> None:
    """The endpoint takes a recording, not a job id: nobody on a recording screen has one."""
    audio_id = _audio(database)
    with database.write_session() as session:
        assert queue.cancel_transcription(session, audio_id) is None, "nothing to stop yet"
        queue.enqueue_transcription(session, audio_id=audio_id, audio_uuid="u")
        stopped = queue.cancel_transcription(session, audio_id)
        assert stopped is not None
        assert stopped.state == queue.CANCELLED
        assert queue.cancel_transcription(session, audio_id) is None, "and not twice"


def test_retrying_resets_the_attempts(database: Database) -> None:
    """Somebody clicking retry has usually just fixed the thing that broke."""
    audio_id = _audio(database)
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        queue.fail(session, job.id, "broke", attempts=queue.MAX_ATTEMPTS)
        assert queue.retry(session, job.id) is True
        work = queue.claim(session)
    assert work is not None
    assert work.attempts == 1


def test_a_job_that_is_still_running_cannot_be_retried(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        queue.claim(session)
        assert queue.retry(session, job.id) is False


def test_the_administration_view_can_count_what_is_where(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id, idempotency_key="a")
        queue.enqueue(session, "waveform", audio_id=audio_id, idempotency_key="b")
        queue.claim(session)
        tally = queue.counts(session)
    assert tally[queue.PENDING] == 1
    assert tally[queue.RUNNING] == 1


def test_the_payload_survives_the_round_trip(database: Database) -> None:
    audio_id = _audio(database)
    with database.write_session() as session:
        queue.enqueue(session, "transcribe", audio_id=audio_id, payload={"language": "ca"})
        work = queue.claim(session)
    assert work is not None
    assert work.payload == {"language": "ca"}


def test_a_job_created_now_is_ready_now(database: Database) -> None:
    job = Job(kind="probe", state=queue.PENDING, attempts=0, created_at=now_instant())
    assert queue.ready_at(job) == job.created_at
