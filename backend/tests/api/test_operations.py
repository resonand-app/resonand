"""The administration view's operational half (``INT-3``).

Three questions an operator has and self-hosted software usually cannot answer: is the background
work getting done, is the archive the size I think it is, and is the schema the one this image
expects.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.core.config import Settings
from sonarium.db import libraries as library_repo
from sonarium.db.audio import create_audio, trash_audio
from sonarium.db.engine import Database
from sonarium.jobs import queue

from tests.api.conftest import API_BASE, sign_in


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
        session_cookie_secure=False,
    )
    app = create_app(settings)
    app.state.database = database
    with TestClient(app, base_url=API_BASE, raise_server_exceptions=False) as keyed:
        sign_in(keyed, "admin")
        response = keyed.get("/admin/transcription")
    assert secret not in response.text
    assert response.json()["has_credential"] is True


def test_a_connection_test_reports_an_unreachable_service_usefully(
    app: FastAPI, client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    def refuse(*_: object, **__: object) -> httpx.Response:
        raise httpx.ConnectError("no route to host", request=httpx.Request("GET", "http://x"))

    monkeypatch.setattr(httpx, "get", refuse)
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is False
    assert "whisper" in tested["detail"]


def test_a_connection_test_reports_success(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(httpx, "get", lambda *_, **__: httpx.Response(200, json={"data": []}))
    sign_in(client, "admin")
    assert client.post("/admin/transcription/test").json()["reachable"] is True


def test_a_rejected_key_is_explained_rather_than_just_reported(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(httpx, "get", lambda *_, **__: httpx.Response(401, text="nope"))
    sign_in(client, "admin")
    tested = client.post("/admin/transcription/test").json()
    assert tested["reachable"] is False
    assert "401" in tested["detail"]
    assert "/v1" in tested["detail"]


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
