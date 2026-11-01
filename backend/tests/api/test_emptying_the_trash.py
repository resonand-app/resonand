"""Destroying much of the trash in one call, and saying first what it would destroy (``API-28``).

The promise under all three routes is that nothing outside what was stated is touched: what the
summary counted is what an empty destroys, a selection destroys only what the caller could have
destroyed one row at a time, and anything trashed after the numbers were read stays.
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import status
from fastapi.testclient import TestClient
from resonand.api.schemas import PURGE_SELECTION_LIMIT
from resonand.core.config import Settings
from resonand.core.levels import Level
from resonand.core.time import instant_after, now_instant, parse_instant
from resonand.db import libraries as library_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.db.models import Audio, Library, Transcript
from resonand.media import storage
from sqlalchemy import select

from tests.api.conftest import sign_in

NOTHING = {"recordings": 0, "libraries": 0, "duration_ms": 0, "transcripts": 0}


def _library(database: Database, owner: int, name: str) -> str:
    with database.write_session() as session:
        return library_repo.create_library(session, owner, name=name).uuid


def _recording(
    database: Database,
    settings: Settings,
    library_uuid: str,
    *,
    duration_ms: int = 60_000,
    transcribed: bool = False,
) -> str:
    """A recording with a real file under it, a duration, and a transcript if asked."""
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.uuid == library_uuid)).scalar_one()
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=library.owner_id,
            storage_path="",
            original_filename="note.m4a",
        )
        audio.duration_ms = duration_ms
        if transcribed:
            session.add(Transcript(audio_id=audio.id, is_active=1, source="service"))
        uuid = audio.uuid
    storage.store_original(settings.resolved_storage_dir, uuid, [b"bytes"], filename="note.m4a")
    return uuid


def _grant(database: Database, owner: int, library_uuid: str, grantee: int, level: Level) -> None:
    with database.write_session() as session:
        library_repo.share_library(session, owner, library_uuid, grantee_id=grantee, level=level)


def _exists(database: Database, audio_uuid: str) -> bool:
    with database.read_session() as session:
        found = session.execute(select(Audio.id).where(Audio.uuid == audio_uuid)).first()
        return found is not None


def _on_disk(settings: Settings, audio_uuid: str) -> bool:
    return storage.recording_dir(settings.resolved_storage_dir, audio_uuid).exists()


def _tally(body: dict[str, object]) -> dict[str, object]:
    return {key: body[key] for key in NOTHING}


def _empty(client: TestClient, trashed_before: str) -> dict[str, object]:
    response = client.delete("/trash", params={"trashed_before": trashed_before})
    assert response.status_code == status.HTTP_200_OK, response.text
    body: dict[str, object] = response.json()
    return body


def _purge(
    client: TestClient, *, audio: list[str] | None = None, libraries: list[str] | None = None
) -> dict[str, object]:
    response = client.post(
        "/trash/purge", json={"audio_uuids": audio or [], "library_uuids": libraries or []}
    )
    assert response.status_code == status.HTTP_200_OK, response.text
    body: dict[str, object] = response.json()
    return body


def test_the_summary_counts_what_the_empty_then_destroys(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """A library takes what is in it, and a recording trashed before its library counts once."""
    archive = _library(database, accounts["admin"], "Archive")
    inside = _recording(database, settings, archive, duration_ms=30_000, transcribed=True)
    also_trashed = _recording(database, settings, archive, duration_ms=20_000)
    loose = _recording(database, settings, owner_library, duration_ms=10_000, transcribed=True)
    kept = _recording(database, settings, owner_library)
    sign_in(client, "admin")
    client.delete(f"/audio/{also_trashed}")
    client.delete(f"/audio/{loose}")
    client.delete(f"/libraries/{archive}")

    summary = client.get("/trash/summary").json()
    assert _tally(summary) == {
        "recordings": 3,
        "libraries": 1,
        "duration_ms": 60_000,
        "transcripts": 2,
    }
    assert _empty(client, summary["counted_at"]) == _tally(summary)

    for gone in (inside, also_trashed, loose):
        assert not _exists(database, gone)
        assert not _on_disk(settings, gone)
    assert _exists(database, kept)
    assert _on_disk(settings, kept)
    assert client.get("/trash/summary").json() | {"counted_at": None} == NOTHING | {
        "counted_at": None
    }
    assert client.get("/trash/libraries").json()["total"] == 0


def test_what_was_trashed_after_the_numbers_were_read_survives_the_empty(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    agreed = _recording(database, settings, owner_library)
    later = _recording(database, settings, owner_library)
    sign_in(client, "admin")
    client.delete(f"/audio/{agreed}")
    counted_at = client.get("/trash/summary").json()["counted_at"]
    client.delete(f"/audio/{later}")
    with database.write_session() as session:
        # Pinned past the summary, because two calls inside one millisecond share an instant.
        row = session.execute(select(Audio).where(Audio.uuid == later)).scalar_one()
        row.deleted_at = instant_after(timedelta(seconds=1), since=parse_instant(counted_at))

    assert _empty(client, counted_at)["recordings"] == 1
    assert not _exists(database, agreed)
    assert _exists(database, later)
    assert _on_disk(settings, later)
    assert client.get("/trash/audio").json()["items"][0]["uuid"] == later


def test_an_editors_trash_empties_nothing_they_do_not_manage(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    theirs = _recording(database, settings, owner_library)
    sign_in(client, "admin")
    client.delete(f"/audio/{theirs}")
    client.delete("/auth/session")

    sign_in(client, "friend")
    summary = client.get("/trash/summary").json()
    assert _tally(summary) == NOTHING
    assert _empty(client, now_instant()) == NOTHING
    assert _purge(client, audio=[theirs]) == {"destroyed": NOTHING, "skipped": [theirs]}
    assert _exists(database, theirs)
    assert _on_disk(settings, theirs)


def test_a_selection_destroys_only_what_was_the_callers_to_destroy(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """The live one, somebody else's and one that never existed are reported in one list, alike,
    for the reason a 404 is never a 403 here."""
    stranger_library = _library(database, accounts["stranger"], "Theirs")
    somebody_elses = _recording(database, settings, stranger_library)
    trashed = _recording(database, settings, owner_library)
    live = _recording(database, settings, owner_library)
    with database.write_session() as session:
        session.execute(
            select(Audio).where(Audio.uuid == somebody_elses)
        ).scalar_one().deleted_at = now_instant()
    sign_in(client, "admin")
    client.delete(f"/audio/{trashed}")
    never = "00000000-0000-0000-0000-000000000000"

    result = _purge(client, audio=[trashed, live, somebody_elses, never])
    assert result["destroyed"] == {**NOTHING, "recordings": 1, "duration_ms": 60_000}
    assert result["skipped"] == [live, somebody_elses, never]
    assert not _exists(database, trashed)
    assert not _on_disk(settings, trashed)
    for untouched in (live, somebody_elses):
        assert _exists(database, untouched)
        assert _on_disk(settings, untouched)


def test_a_library_and_a_recording_inside_it_are_destroyed_and_counted_once(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    archive = _library(database, accounts["admin"], "Archive")
    trashed_first = _recording(database, settings, archive)
    left_in_it = _recording(database, settings, archive)
    sign_in(client, "admin")
    client.delete(f"/audio/{trashed_first}")
    client.delete(f"/libraries/{archive}")

    result = _purge(client, audio=[trashed_first, left_in_it], libraries=[archive, archive])
    assert result == {
        "destroyed": {**NOTHING, "recordings": 2, "libraries": 1, "duration_ms": 120_000},
        "skipped": [],
    }
    with database.read_session() as session:
        assert session.execute(select(Library).where(Library.uuid == archive)).first() is None
    for gone in (trashed_first, left_in_it):
        assert not _exists(database, gone)
        assert not _on_disk(settings, gone)


def test_a_library_that_is_not_in_the_trash_is_skipped_with_everything_in_it(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    inside = _recording(database, settings, owner_library)
    sign_in(client, "admin")
    assert _purge(client, libraries=[owner_library]) == {
        "destroyed": NOTHING,
        "skipped": [owner_library],
    }
    assert _exists(database, inside)


def test_a_selection_past_the_bound_is_refused(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    too_many = [f"{n:032x}" for n in range(PURGE_SELECTION_LIMIT + 1)]
    response = client.post("/trash/purge", json={"audio_uuids": too_many})
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_emptying_needs_the_instant_the_numbers_were_counted_at(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Defaulting to now would destroy whatever arrived after somebody read the summary."""
    sign_in(client, "admin")
    assert client.delete("/trash").status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    for refused in (
        "2026-11-01T12:00:00",
        # Written unpadded, it would sort after every real instant and bound nothing.
        "0999-01-01T00:00:00Z",
        "0001-01-01T00:00:00+05:00",
    ):
        response = client.delete("/trash", params={"trashed_before": refused})
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT, refused


def test_the_trash_as_a_whole_needs_an_account(client: TestClient) -> None:
    assert client.get("/trash/summary").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.post("/trash/purge", json={}).status_code == status.HTTP_401_UNAUTHORIZED
    unauthenticated = client.delete("/trash", params={"trashed_before": now_instant()})
    assert unauthenticated.status_code == status.HTTP_401_UNAUTHORIZED
