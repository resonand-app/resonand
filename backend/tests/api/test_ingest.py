"""Upload, playback and download over HTTP (``ING-2``, ``ING-7``, ``ING-8``)."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import unquote

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sonarium.api.app import create_app
from sonarium.core.config import Settings
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Audio, Job, Library
from sonarium.media import storage
from sqlalchemy import select

from tests.api.conftest import ClientFactory, sign_in
from tests.media.conftest import make_audio, needs_ffmpeg


def _upload(client: TestClient, library_uuid: str, path: Path, **data: str) -> dict[str, object]:
    with path.open("rb") as handle:
        response = client.post(
            f"/libraries/{library_uuid}/audio",
            files={"file": (path.name, handle, "audio/wav")},
            data=data,
        )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    return dict(response.json())


def _already_here(database: Database, library_uuid: str, owner_id: int) -> str:
    """A recording that is already in the archive, for the tests that need one to write to."""
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.uuid == library_uuid)).scalar_one()
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner_id,
            storage_path="aa/none/original.wav",
            original_filename="Already here.wav",
        )
        return audio.uuid


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


# --- The write lock covers the row, not the recording (``REV-1``) ---------


def test_a_slow_upload_does_not_stop_everybody_else_writing(
    client: TestClient,
    app_client_factory: ClientFactory,
    monkeypatch: pytest.MonkeyPatch,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
    tmp_path: Path,
) -> None:
    """``REV-1``: an upload used to hold the single write lock for its whole length.

    An hour of driving is an hour in which nothing else in the instance could write -- not a
    renamed recording, not a sign-in, not the worker claiming a job. This test pins the upload
    open at the point where the bytes are being written and requires another writer to get
    through it, which is the only way to tell the two arrangements apart.
    """
    sign_in(client, "admin")
    existing = _already_here(database, owner_library, accounts["admin"])

    writing_bytes = threading.Event()
    let_it_finish = threading.Event()
    store = storage.store_original

    def slowly(*args: object, **kwargs: object) -> object:
        writing_bytes.set()
        let_it_finish.wait(timeout=30)
        return store(*args, **kwargs)  # type: ignore[arg-type]

    monkeypatch.setattr(storage, "store_original", slowly)

    uploader = app_client_factory()
    sign_in(uploader, "admin")
    recording = tmp_path / "slow.wav"
    recording.write_bytes(b"RIFF" + bytes(1024))

    with ThreadPoolExecutor(max_workers=2) as pool:
        uploading = pool.submit(_upload, uploader, owner_library, recording)
        assert writing_bytes.wait(timeout=10), "the upload never reached the bytes"
        renaming = pool.submit(client.patch, f"/audio/{existing}", json={"title": "Renamed"})
        try:
            renamed = renaming.result(timeout=10)
        finally:
            let_it_finish.set()

    assert renamed.status_code == status.HTTP_200_OK, renamed.text
    assert renamed.json()["title"] == "Renamed"
    assert uploading.result()["title"] == "slow", "and the upload still finished"


def test_an_upload_that_is_refused_leaves_nothing_in_the_archive(
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
    tmp_path: Path,
) -> None:
    """The bytes are written before the row exists, so a refusal has to take them away again.

    Over the limit is the ordinary way for an upload to fail late: it is only discovered while
    streaming, because ``Content-Length`` is something a client can lie about.
    """
    app = create_app(settings.model_copy(update={"max_upload_bytes": 64}))
    app.state.database = database
    oversized = tmp_path / "too big.wav"
    oversized.write_bytes(b"RIFF" + bytes(4096))

    with TestClient(app, raise_server_exceptions=False) as client:
        sign_in(client, "admin")
        with oversized.open("rb") as handle:
            refused = client.post(
                f"/libraries/{owner_library}/audio",
                files={"file": (oversized.name, handle, "audio/wav")},
            )

    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert "larger than this instance accepts" in refused.json()["detail"]
    assert list(settings.resolved_storage_dir.iterdir()) == [], "no half-written recording"
    with database.read_session() as session:
        assert session.execute(select(Audio)).all() == [], "and no row describing one"
