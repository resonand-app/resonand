"""Asking for a transcription on a recording that already exists, and hearing how it went.

``API-11`` is the request and ``API-17`` is the answer, and they are here together because they
are one feature from the interface's side: the call to action, the state it becomes, and the
failure it can end in are one panel (``UI-15``).

Until this endpoint, transcription could only be asked for at upload, which left three things
unreachable from the interface: the call to action on a recording that has no transcript
(``UI-15a``), the retry after a failure (``UI-15c``) and re-transcribing one that already has a
transcript (``UI-14``). All three are this one endpoint, which is why the case that matters most
here is the second click.
"""

from __future__ import annotations

import json

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core.levels import Level
from sonarium.db import libraries as library_repo
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Job
from sonarium.jobs import queue
from sqlalchemy import select

from tests.api.conftest import sign_in


def _a_recording(
    database: Database, accounts: dict[str, int], owner_library: str, *, name: str = "note.m4a"
) -> str:
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, accounts["admin"])
            if row[0].uuid == owner_library
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=accounts["admin"],
            storage_path=f"aa/{name}/original.m4a",
            original_filename=name,
        )
        session.flush()
        return audio.uuid


def _transcribe_jobs(database: Database) -> list[Job]:
    with database.write_session() as session:
        return list(
            session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE).order_by(Job.id))
            .scalars()
            .all()
        )


# --- Asking --------------------------------------------------------------


def test_asking_queues_the_work_and_says_so(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """202 and the job, because the answer is "it is on its way", not "here is your transcript"."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    asked = client.post(f"/audio/{audio_uuid}/transcribe", json={})
    assert asked.status_code == status.HTTP_202_ACCEPTED
    job = asked.json()
    assert job["kind"] == "transcribe"
    assert job["state"] == "pending"
    assert job["audio_uuid"] == audio_uuid


def test_the_recording_then_reads_as_running(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``UI-15b`` draws this state, so the badge has to agree with the job that was just made."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    assert client.get(f"/audio/{audio_uuid}").json()["transcription_state"] == "running"


def test_a_chosen_language_reaches_the_job(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={"language": "ca"})
    assert json.loads(_transcribe_jobs(database)[0].payload or "{}") == {"language": "ca"}


def test_no_language_means_let_the_provider_decide(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``JOB-2``'s contract: absent is auto-detect, and is not the same as a guess."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    assert json.loads(_transcribe_jobs(database)[0].payload or "{}") == {}


# --- The second click ----------------------------------------------------


def test_asking_twice_is_a_conflict_and_not_a_second_transcription(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The case this endpoint is shaped around.

    The call to action and the retry button are the same request, so a double click has to cost
    one transcription. The interface renders the 409 as a state rather than as an error.
    """
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_202_ACCEPTED
    )
    again = client.post(f"/audio/{audio_uuid}/transcribe", json={})
    assert again.status_code == status.HTTP_409_CONFLICT
    assert "already being transcribed" in again.json()["detail"]
    assert len(_transcribe_jobs(database)) == 1


def test_a_job_waiting_on_its_backoff_still_counts_as_in_flight(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """A failed job goes back to ``pending`` until its attempts run out. It is going to run, so
    asking again would queue a duplicate of work already scheduled."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        assert queue.fail(session, work.id, "whisper is down", attempts=work.attempts) == "pending"
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_409_CONFLICT
    )


def test_a_recording_whose_transcription_failed_for_good_can_be_retried(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``UI-15c``'s retry. The old job stays where it is, and a new one is queued beside it."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "the provider refused the key", attempts=queue.MAX_ATTEMPTS)
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_202_ACCEPTED
    )
    assert len(_transcribe_jobs(database)) == 2


def test_a_recording_transcribed_at_upload_can_be_transcribed_again(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The reason the idempotency key had to change.

    It was ``transcribe:{uuid}``, which is permanent, so once a recording had been through the
    queue every later request found the key taken and was discarded silently: no second job, no
    conflict, and no way for the interface to tell which had happened.
    """
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.finish(session, work.id)
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_202_ACCEPTED
    )
    keys = [job.idempotency_key for job in _transcribe_jobs(database)]
    assert keys == [f"transcribe:{audio_uuid}:1", f"transcribe:{audio_uuid}:2"]


# --- What there is to say about it ---------------------------------------


def test_a_recording_nobody_has_asked_about_reports_no_attempts(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``UI-15a`` draws its call to action against this, so it has to be a state and not a 404."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    status_of = client.get(f"/audio/{audio_uuid}/transcription")
    assert status_of.status_code == status.HTTP_200_OK
    assert status_of.json() == {
        "state": "none",
        "attempts": 0,
        "started_at": None,
        "error": None,
    }


def test_a_running_transcription_says_when_it_started(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The fact ``UI-15b`` counts "started 4 minutes ago" from, and the reason this endpoint
    exists: it is on the job and the recording carries no trace of it."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        assert queue.claim(session) is not None
    reported = client.get(f"/audio/{audio_uuid}/transcription").json()
    assert reported["state"] == "running"
    assert reported["attempts"] == 1
    assert reported["started_at"] is not None


def test_a_queued_transcription_has_no_elapsed_time_to_report(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """A job nobody has claimed is a wait, not an elapsed time. Reporting one would have the
    interface counting minutes from a moment that has not happened."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    reported = client.get(f"/audio/{audio_uuid}/transcription").json()
    assert reported["state"] == "running"
    assert reported["started_at"] is None


def test_a_job_waiting_out_its_backoff_reports_no_elapsed_time_either(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """It carries the ``started_at`` of the attempt that failed, and that run is over."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        assert queue.fail(session, work.id, "whisper is down", attempts=work.attempts) == "pending"
    reported = client.get(f"/audio/{audio_uuid}/transcription").json()
    assert reported["state"] == "running"
    assert reported["started_at"] is None
    assert reported["error"] == "whisper is down"


def test_a_failure_reports_the_provider_own_words(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``UI-15c`` shows the real error rather than apologising, and this is the only place it is.

    The attempt count comes with it, and it is the attempts made rather than the attempts
    allowed: ``fail`` was told to give up, and the job had run once when it did.
    """
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "the provider refused the key", attempts=queue.MAX_ATTEMPTS)
    reported = client.get(f"/audio/{audio_uuid}/transcription").json()
    assert reported == {
        "state": "failed",
        "attempts": 1,
        "started_at": None,
        "error": "the provider refused the key",
    }


def test_it_reports_the_newest_attempt_rather_than_the_one_that_failed(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """After a retry the old failure is still in the job table, and showing its error beside a
    transcription that is running again would be an error about nothing."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "the provider refused the key", attempts=queue.MAX_ATTEMPTS)
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    reported = client.get(f"/audio/{audio_uuid}/transcription").json()
    assert reported["state"] == "running"
    assert reported["error"] is None


def test_a_transcript_that_exists_wins_over_a_failure_here_too(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The state is the badge's state, from one function, so this endpoint and the card on the
    library screen cannot say different things about the same recording."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    client.post(f"/audio/{audio_uuid}/transcribe", json={})
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.finish(session, work.id)
    assert client.get(f"/audio/{audio_uuid}/transcription").json()["state"] == "none"


def test_a_reader_may_ask_how_their_own_recording_is_going(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Read level, not edit. Somebody who can hear a recording and is told nothing about why it
    has no transcript is exactly the person this endpoint was added for."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "friend")
    assert client.get(f"/audio/{audio_uuid}/transcription").status_code == status.HTTP_200_OK


def test_somebody_elses_recording_has_no_transcription_to_report(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``DEC-14`` again: 404 rather than 403, so the answer does not confirm it exists."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "stranger")
    assert client.get(f"/audio/{audio_uuid}/transcription").status_code == status.HTTP_404_NOT_FOUND


# --- Who may ask ---------------------------------------------------------


def test_a_reader_is_told_they_cannot_rather_than_that_it_is_missing(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Transcribing spends somebody's provider quota and changes what the recording says, so it
    takes level 20 -- and a reader can see it, so 403 tells them nothing they did not know."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "friend")
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert _transcribe_jobs(database) == []


def test_somebody_elses_recording_does_not_exist(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``DEC-14``: a 403 here would confirm the recording exists."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "stranger")
    assert (
        client.post(f"/audio/{audio_uuid}/transcribe", json={}).status_code
        == status.HTTP_404_NOT_FOUND
    )
