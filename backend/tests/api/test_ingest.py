"""Upload, playback and download over HTTP (``ING-2``, ``ING-7``, ``ING-8``)."""

from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sonarium.db.engine import Database
from sonarium.db.models import Audio, Job
from sqlalchemy import select

from tests.api.conftest import ClientFactory, sign_in
from tests.media.conftest import make_audio, needs_ffmpeg


def _upload(client: TestClient, library_uuid: str, path: Path, **data: object) -> dict[str, object]:
    with path.open("rb") as handle:
        response = client.post(
            f"/libraries/{library_uuid}/audio",
            files={"file": (path.name, handle, "audio/wav")},
            data=data,
        )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return dict(response.json())


@pytest.fixture
def recording(tmp_path: Path) -> Path:
    return make_audio(tmp_path / "Recording 2024-03-11 18.22.wav", seconds=2.0)


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_an_uploaded_recording_is_stored_and_hashed_in_one_pass(
    client: TestClient,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    assert made["sha256"]
    assert made["size_bytes"] == recording.stat().st_size
    assert made["title"] == "Recording 2024-03-11 18.22", "the filename, lightly cleaned"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_the_bytes_that_come_back_are_the_bytes_that_went_in(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    """Principle 1 at its most literal, end to end over HTTP."""
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    downloaded = client.get(f"/audio/{made['uuid']}/original")
    assert downloaded.content == recording.read_bytes()
    disposition = unquote(downloaded.headers["content-disposition"])
    assert "Recording 2024-03-11 18.22.wav" in disposition, "under the name it arrived with"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_uploading_queues_the_work_rather_than_doing_it_in_the_request(
    client: TestClient,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    """A browser will not wait for an hour of driving to be transcoded."""
    sign_in(client, "admin")
    _upload(client, owner_library, recording)
    with database.read_session() as session:
        kinds = [job.kind for job in session.execute(select(Job)).scalars().all()]
    assert kinds == ["probe"]


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_asking_for_transcription_at_upload_queues_it(
    client: TestClient,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    sign_in(client, "admin")
    _upload(client, owner_library, recording, transcribe="true", language="ca")
    with database.read_session() as session:
        jobs = {job.kind: job.payload for job in session.execute(select(Job)).scalars().all()}
    assert "transcribe" in jobs
    assert "ca" in (jobs["transcribe"] or "")


def test_a_format_the_archive_does_not_ingest_is_refused(
    client: TestClient, accounts: dict[str, int], owner_library: str, tmp_path: Path
) -> None:
    sign_in(client, "admin")
    document = tmp_path / "notes.pdf"
    document.write_bytes(b"not audio")
    with document.open("rb") as handle:
        refused = client.post(
            f"/libraries/{owner_library}/audio",
            files={"file": (document.name, handle, "application/pdf")},
        )
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert "not a format" in refused.json()["detail"]


def test_a_reader_cannot_upload_into_somebody_elses_library(
    client: TestClient, accounts: dict[str, int], owner_library: str, tmp_path: Path
) -> None:
    sign_in(client, "stranger")
    audio = tmp_path / "note.wav"
    audio.write_bytes(b"RIFF")
    with audio.open("rb") as handle:
        refused = client.post(
            f"/libraries/{owner_library}/audio", files={"file": (audio.name, handle, "audio/wav")}
        )
    assert refused.status_code == status.HTTP_404_NOT_FOUND, "not a 403: they cannot see it"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_playback_serves_the_file_and_says_it_accepts_ranges(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    played = client.get(f"/audio/{made['uuid']}/stream")
    assert played.status_code == status.HTTP_200_OK
    assert played.headers["accept-ranges"] == "bytes"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_seeking_returns_exactly_the_bytes_asked_for(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    """The test the plan insists on: seeking has to work for real."""
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    whole = client.get(f"/audio/{made['uuid']}/stream").content

    middle = client.get(f"/audio/{made['uuid']}/stream", headers={"Range": "bytes=100-199"})
    assert middle.status_code == status.HTTP_206_PARTIAL_CONTENT
    assert middle.content == whole[100:200]
    assert middle.headers["content-range"] == f"bytes 100-199/{len(whole)}"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_overlapping_ranges_each_return_their_own_bytes(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    whole = client.get(f"/audio/{made['uuid']}/stream").content
    first = client.get(f"/audio/{made['uuid']}/stream", headers={"Range": "bytes=0-299"})
    second = client.get(f"/audio/{made['uuid']}/stream", headers={"Range": "bytes=200-499"})
    assert first.content == whole[0:300]
    assert second.content == whole[200:500]


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_an_open_ended_range_runs_to_the_end(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    whole = client.get(f"/audio/{made['uuid']}/stream").content
    tail = client.get(
        f"/audio/{made['uuid']}/stream", headers={"Range": f"bytes={len(whole) - 50}-"}
    )
    assert tail.content == whole[-50:]


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_range_past_the_end_is_refused_with_the_length(
    client: TestClient, accounts: dict[str, int], owner_library: str, recording: Path
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    beyond = client.get(
        f"/audio/{made['uuid']}/stream", headers={"Range": "bytes=99999999-100000000"}
    )
    assert beyond.status_code == status.HTTP_416_RANGE_NOT_SATISFIABLE
    assert beyond.headers["content-range"].startswith("bytes */")


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_playback_token_lets_the_audio_element_play_without_a_cookie(
    client: TestClient,
    app_client_factory: ClientFactory,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    """<audio> cannot send an Authorization header and does not always send cookies."""
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    token = client.post(f"/audio/{made['uuid']}/playback-token").json()["token"]

    anonymous = app_client_factory()
    played = anonymous.get(f"/audio/{made['uuid']}/stream", params={"token": token})
    assert played.status_code == status.HTTP_200_OK


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_token_for_one_recording_does_not_open_another(
    client: TestClient,
    app_client_factory: ClientFactory,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    """A leaked link is one recording, not an archive."""
    sign_in(client, "admin")
    first = _upload(client, owner_library, recording)
    second = _upload(client, owner_library, make_audio(recording.parent / "other.wav", seconds=1.0))
    token = client.post(f"/audio/{first['uuid']}/playback-token").json()["token"]

    anonymous = app_client_factory()
    refused = anonymous.get(f"/audio/{second['uuid']}/stream", params={"token": token})
    assert refused.status_code == status.HTTP_401_UNAUTHORIZED


def test_playback_without_a_session_or_a_token_does_not_confirm_the_recording_exists(
    client: TestClient,
) -> None:
    refused = client.get("/audio/00000000-0000-4000-8000-000000000000/stream")
    assert refused.status_code == status.HTTP_404_NOT_FOUND


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_missing_file_says_so_rather_than_serving_nothing(
    client: TestClient,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
    recording: Path,
) -> None:
    sign_in(client, "admin")
    made = _upload(client, owner_library, recording)
    with database.write_session() as session:
        row = session.execute(select(Audio).where(Audio.uuid == made["uuid"])).scalar_one()
        row.storage_path = "aa/missing/original.wav"
    gone = client.get(f"/audio/{made['uuid']}/original")
    assert gone.status_code == status.HTTP_404_NOT_FOUND
    assert "missing from storage" in gone.json()["detail"]
