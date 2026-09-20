"""The administration view's operational half (``INT-3``).

Three questions an operator has and self-hosted software usually cannot answer: is the background
work getting done, is the archive the size I think it is, and is the schema the one this image
expects.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.routes import operations
from sonarium.api.security import hash_password
from sonarium.core.config import Settings
from sonarium.core.errors import ToolError
from sonarium.db import libraries as library_repo
from sonarium.db import users as user_repo
from sonarium.db.audio import create_audio, trash_audio
from sonarium.db.engine import Database
from sonarium.jobs import queue
from sonarium.transcription import preflight
from sonarium.transcription.openai_compatible import OpenAiCompatibleProvider

from tests.api.conftest import API_BASE, PASSWORD, sign_in


def _a_job(database: Database, accounts: dict[str, int], owner_library: str) -> int:
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
            storage_path="aa/x/original.m4a",
            original_filename="note.m4a",
        )
        job = queue.enqueue(session, "probe", audio_id=audio.id)
        assert job is not None
        return job.id


# --- The job queue --------------------------------------------------------


def test_the_queue_is_listed_newest_first(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The reason somebody opens this page is that something has just gone wrong."""
    first = _a_job(database, accounts, owner_library)
    second = _a_job(database, accounts, owner_library)
    sign_in(client, "admin")
    listed = client.get("/admin/jobs").json()
    assert [row["id"] for row in listed["items"]][:2] == [second, first]


def test_a_job_carries_the_recording_it_is_about(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    _a_job(database, accounts, owner_library)
    sign_in(client, "admin")
    job = client.get("/admin/jobs").json()["items"][0]
    assert job["audio_uuid"]
    assert job["kind"] == "probe"


def test_a_pending_job_says_when_it_will_be_tried_again(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """What a backoff looks like from outside, so a queue that is waiting does not read as a
    queue that is stuck."""
    job_id = _a_job(database, accounts, owner_library)
    with database.write_session() as session:
        work = queue.claim(session)
        assert work is not None
        queue.fail(session, work.id, "whisper is down", attempts=work.attempts)
    sign_in(client, "admin")
    job = next(row for row in client.get("/admin/jobs").json()["items"] if row["id"] == job_id)
    assert job["state"] == queue.PENDING
    assert job["ready_at"] is not None
    assert job["error"] == "whisper is down", "the real message, which UI-15 shows"


def test_the_queue_can_be_filtered_by_state(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    _a_job(database, accounts, owner_library)
    sign_in(client, "admin")
    pending = client.get("/admin/jobs", params={"state": "pending"}).json()
    assert pending["total"] >= 1
    assert {row["state"] for row in pending["items"]} == {"pending"}


def test_a_failed_job_can_be_retried_with_its_attempts_reset(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    job_id = _a_job(database, accounts, owner_library)
    with database.write_session() as session:
        queue.fail(session, job_id, "broke", attempts=queue.MAX_ATTEMPTS)
    sign_in(client, "admin")
    assert client.post(f"/admin/jobs/{job_id}/retry").json()["state"] == "pending"
    with database.write_session() as session:
        work = queue.claim(session)
    assert work is not None
    assert work.attempts == 1


def test_a_job_can_be_cancelled(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    job_id = _a_job(database, accounts, owner_library)
    sign_in(client, "admin")
    assert client.post(f"/admin/jobs/{job_id}/cancel").json()["state"] == "cancelled"
    with database.write_session() as session:
        assert queue.claim(session) is None


def test_retrying_something_that_is_not_failed_says_so(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    job_id = _a_job(database, accounts, owner_library)
    sign_in(client, "admin")
    assert client.post(f"/admin/jobs/{job_id}/retry").status_code == status.HTTP_404_NOT_FOUND


def test_the_queue_is_not_visible_to_everybody(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    assert client.get("/admin/jobs").status_code == status.HTTP_403_FORBIDDEN


def test_the_counts_agree_with_the_rows_they_sit_above(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``FBK-4``: the summary and the list are one table, and must not disagree on screen."""
    job_id = _a_job(database, accounts, owner_library)
    _a_job(database, accounts, owner_library)
    with database.write_session() as session:
        queue.fail(session, job_id, "broke", attempts=queue.MAX_ATTEMPTS)
    sign_in(client, "admin")
    counts = client.get("/admin/jobs/counts").json()
    assert counts["failed"] == 1
    assert (
        counts["pending"] == client.get("/admin/jobs", params={"state": "pending"}).json()["total"]
    )


def test_the_counts_name_every_state_including_the_empty_ones(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """A state missing from the tally would draw as a gap rather than as a nought."""
    sign_in(client, "admin")
    counts = client.get("/admin/jobs/counts").json()
    assert set(counts) >= {
        queue.PENDING,
        queue.RUNNING,
        queue.DONE,
        queue.FAILED,
        queue.CANCELLED,
    }


def test_the_counts_are_not_visible_to_everybody(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    assert client.get("/admin/jobs/counts").status_code == status.HTTP_403_FORBIDDEN


# --- The transcription provider -------------------------------------------


def test_the_provider_is_reported_without_contacting_it(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Principle 2: a page that quietly contacted a provider to draw a green dot would be a
    smaller version of the same violation."""
    sign_in(client, "admin")
    reported = client.get("/admin/transcription").json()
    assert reported["configured"] is True
    assert reported["reachable"] is None, "nothing was contacted"
    assert "connection test" in reported["detail"]


def test_the_credential_is_never_reported_in_any_form(
    tmp_path_factory: pytest.TempPathFactory, database: Database, accounts: dict[str, int]
) -> None:
    """What an administrator needs to know is whether one is set, not what it is."""
    secret = "sk-a-secret-nobody-should-see"
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("keyed"),
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        transcription_api_key=SecretStr(secret),
    )
    app = create_app(settings)
    app.state.database = database
    with TestClient(app, base_url=API_BASE, raise_server_exceptions=False) as keyed:
        sign_in(keyed, "admin")
        response = keyed.get("/admin/transcription")
    assert secret not in response.text
    assert response.json()["has_credential"] is True


def _answering(
    monkeypatch: pytest.MonkeyPatch,
    payload: dict[str, object] | None = None,
    *,
    status_code: int = 200,
    text: str | None = None,
    raises: Exception | None = None,
) -> None:
    """Point the check at a transcription service that answers however this test needs.

    The sample is stubbed as well: the provider is mocked, so what is in the file never reaches a
    decoder, and the endpoint's own logic is what these are about. That ffmpeg really produces one
    is pinned in ``tests/transcription/test_preflight.py``.
    """

    def handle(request: httpx.Request) -> httpx.Response:
        if raises is not None:
            raise raises
        if text is not None:
            return httpx.Response(status_code, text=text)
        return httpx.Response(status_code, json=payload or {})

    def build(settings: Settings, *, usage: object = None) -> OpenAiCompatibleProvider:
        return OpenAiCompatibleProvider(
            base_url=settings.transcription_base_url or "http://whisper:8000/v1",
            model=settings.transcription_model,
            client=httpx.Client(transport=httpx.MockTransport(handle)),
        )

    def sample(destination: Path, *, seconds: float = 3.0) -> Path:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(b"three seconds of tone, as far as a mocked engine can tell")
        return destination

    monkeypatch.setattr(operations, "build_provider", build)
    monkeypatch.setattr(preflight, "sample_audio", sample)


SPEECH: dict[str, object] = {
    "language": "en",
    "segments": [{"start": 0.0, "end": 1.4, "text": "one two"}],
}


def test_a_connection_test_reports_an_unreachable_service_usefully(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    _answering(
        monkeypatch,
        raises=httpx.ConnectError("no route to host", request=httpx.Request("POST", "http://x")),
    )
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is False
    assert tested["usable"] is False
    assert "whisper" in tested["detail"]


def test_a_connection_test_reports_success(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    _answering(monkeypatch, SPEECH)
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is True
    assert tested["usable"] is True


def test_a_check_is_remembered_and_reported_without_contacting_anything_again(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """``BUG-3a``: principle 2 forbids reaching out on a read, not remembering that somebody did.

    The verdict used to exist only in the answer to the request that produced it, so the next read
    of the page reported that nothing was known -- which is a different sentence from nothing
    having been asked, and only the second one was ever true.
    """
    _answering(monkeypatch, SPEECH)
    sign_in(client, "admin")
    checked = client.post("/admin/transcription/test").json()
    assert checked["checked_at"] is not None
    assert checked["checked_by"] == "Admin"

    def refuse(*args: object, **kwargs: object) -> object:
        raise AssertionError("a read contacted the provider")

    monkeypatch.setattr(operations, "build_provider", refuse)
    reported = client.get("/admin/transcription").json()
    assert reported["reachable"] is True
    assert reported["usable"] is True
    assert reported["checked_at"] == checked["checked_at"]
    assert reported["detail"] == checked["detail"]


def test_a_check_belongs_to_the_instance_rather_than_to_whoever_ran_it(
    client: TestClient,
    database: Database,
    accounts: dict[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """An instance has more than one administrator, and this is the half a browser cannot hold."""
    _answering(monkeypatch, SPEECH)
    sign_in(client, "admin")
    client.post("/admin/transcription/test")
    with database.write_session() as session:
        user_repo.create_user(
            session,
            email="second@example.test",
            display_name="Second",
            password_hash=hash_password(PASSWORD),
            is_admin=True,
        )
    sign_in(client, "second")
    reported = client.get("/admin/transcription").json()
    assert reported["usable"] is True
    assert reported["checked_by"] == "Admin", "whose check it was, not who is looking at it"


def test_a_check_that_could_not_be_run_is_recorded_rather_than_left_looking_unchecked(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """Neither a pass nor a failure of the engine: this instance could not produce the sample.

    Reporting it as unchecked would lose the one sentence that explains why, and reporting it as
    unreachable would blame a provider that was never contacted.
    """
    _answering(monkeypatch, SPEECH)

    def no_sample(destination: Path, *, seconds: float = 3.0) -> Path:
        raise ToolError("ffmpeg is not installed")

    monkeypatch.setattr(preflight, "sample_audio", no_sample)
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is None, "nothing was contacted"
    assert tested["checked_at"] is not None, "but somebody did ask"
    assert "nothing was sent" in tested["detail"]
    assert client.get("/admin/transcription").json()["detail"] == tested["detail"]


def test_a_model_that_cannot_return_segments_is_reported_unusable_rather_than_reachable(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """``TRX-10``: the misconfiguration this check exists to catch.

    The endpoint is there, the credentials are accepted, every request is answered -- and the
    model behind it returns prose with no timings, which this archive cannot store. A check that
    only asked whether something was listening would go green on it, and an administrator would
    believe it until the first recording had been uploaded.
    """
    _answering(monkeypatch, {"text": "one two three, and no timings anywhere"})
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is True, "it answered perfectly well"
    assert tested["usable"] is False, "and it still cannot transcribe for this archive"
    assert "segments" in tested["detail"]


def test_a_rejected_key_is_explained_rather_than_just_reported(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """A service that refuses a key has answered: the address is right and the credential is not."""
    _answering(monkeypatch, status_code=401, text="nope")
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is True
    assert tested["usable"] is False
    assert "SONARIUM_TRANSCRIPTION_API_KEY" in tested["detail"]


# --- The instance ---------------------------------------------------------


def test_the_status_says_where_the_schema_is_and_where_it_should_be(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """The load-bearing pair: it says whether to roll the image back or the database forward."""
    sign_in(client, "admin")
    reported = client.get("/admin/status").json()
    assert reported["database_revision"] == reported["expected_revision"]
    assert reported["database_revision"] is not None


def test_the_status_counts_the_archive(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, accounts["admin"])
            if row[0].uuid == owner_library
        )
        kept = create_audio(
            session,
            library_id=library.id,
            uploaded_by=accounts["admin"],
            storage_path="aa/x/original.m4a",
            original_filename="kept.m4a",
        )
        kept.duration_ms = 60_000
        gone = create_audio(
            session,
            library_id=library.id,
            uploaded_by=accounts["admin"],
            storage_path="aa/y/original.m4a",
            original_filename="gone.m4a",
        )
        session.flush()
        trash_audio(session, accounts["admin"], gone.uuid)
    sign_in(client, "admin")
    storage = client.get("/admin/status").json()["storage"]
    assert storage["recordings"] == 1
    assert storage["trashed_recordings"] == 1
    assert storage["total_duration_ms"] == 60_000
    assert storage["database_bytes"] > 0


def test_the_status_reports_the_retention_somebody_would_otherwise_have_to_guess(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    assert client.get("/admin/status").json()["trash_retention_days"] == 30
