"""A recording in the trash, opened at its own address (``BUG-7``, ``UI-11d``).

Its page plays it and offers to put it back, under a band saying how long is left -- which needs
the recording, its waveform, its transcript and its audio to answer somebody who could restore it.
Anybody below that is answered as though it were not there, which is what they were told before
it was in the trash and what ``DEC-14`` asks of a recording they cannot act on.
"""

from __future__ import annotations

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from resonand.core.config import Settings
from resonand.core.levels import Level
from resonand.db import libraries as library_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.db.models import Audio
from resonand.media import storage, waveform
from sqlalchemy import select

from tests.api.conftest import sign_in

READS = (
    "/audio/{uuid}",
    "/audio/{uuid}/waveform",
    "/audio/{uuid}/transcripts",
    "/audio/{uuid}/transcription",
    "/audio/{uuid}/stream",
    "/audio/{uuid}/original",
)
"""Every read the recording's page makes, beside the playback token, which is a POST."""


def _trashed(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    library_uuid: str,
    friend_level: Level | None,
) -> str:
    """A recording with bytes and peaks, trashed by the library's owner, in a library shared with
    ``friend`` at ``friend_level``."""
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, accounts["admin"])
            if row[0].uuid == library_uuid
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=accounts["admin"],
            storage_path="",
            original_filename="note.m4a",
            title="Note",
        )
        audio_uuid = audio.uuid
        path, _ = storage.store_original(
            settings.resolved_storage_dir, audio_uuid, [b"bytes"], filename="note.m4a"
        )
        audio.storage_path = storage.relative(settings.resolved_storage_dir, path)
        audio.waveform = waveform.encode(waveform.Waveform(duration_ms=3_000, pairs=((-1, 1),) * 4))
        if friend_level is not None:
            library_repo.share_library(
                session,
                accounts["admin"],
                library_uuid,
                grantee_id=accounts["friend"],
                level=friend_level,
            )
    sign_in(client, "admin")
    assert client.delete(f"/audio/{audio_uuid}").status_code == status.HTTP_204_NO_CONTENT
    client.delete("/auth/session")
    return audio_uuid


@pytest.mark.parametrize("who", ["admin", "friend"])
def test_whoever_could_restore_it_can_open_it_and_play_it(
    who: str,
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """The owner, and somebody the library is shared with at manage -- the two the trash lists it
    to -- read every part of it the page draws."""
    audio_uuid = _trashed(client, database, settings, accounts, owner_library, Level.MANAGE)
    sign_in(client, who)
    detail = client.get(f"/audio/{audio_uuid}")
    assert detail.status_code == status.HTTP_200_OK
    assert detail.json()["deleted_at"] is not None
    for read in READS:
        assert client.get(read.format(uuid=audio_uuid)).status_code == status.HTTP_200_OK, read
    token = client.post(f"/audio/{audio_uuid}/playback-token")
    assert token.status_code == status.HTTP_200_OK


@pytest.mark.parametrize("level", [Level.READ, Level.EDIT])
def test_below_manage_it_is_not_there(
    level: Level,
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """A reader or an editor could not restore it and is not told it is in the trash."""
    audio_uuid = _trashed(client, database, settings, accounts, owner_library, level)
    sign_in(client, "friend")
    for read in READS:
        response = client.get(read.format(uuid=audio_uuid))
        assert response.status_code == status.HTTP_404_NOT_FOUND, read
    token = client.post(f"/audio/{audio_uuid}/playback-token")
    assert token.status_code == status.HTTP_404_NOT_FOUND


def test_somebody_with_no_access_is_told_nothing(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    audio_uuid = _trashed(client, database, settings, accounts, owner_library, None)
    sign_in(client, "stranger")
    for read in READS:
        response = client.get(read.format(uuid=audio_uuid))
        assert response.status_code == status.HTTP_404_NOT_FOUND, read


def test_nothing_in_the_trash_is_edited(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """Shown is not editable: the writes keep answering a trashed recording as absent."""
    audio_uuid = _trashed(client, database, settings, accounts, owner_library, None)
    sign_in(client, "admin")
    assert (
        client.patch(f"/audio/{audio_uuid}", json={"title": "Changed"}).status_code
        == status.HTTP_404_NOT_FOUND
    )
    assert client.put(f"/audio/{audio_uuid}/favourite").status_code == status.HTTP_404_NOT_FOUND
    with database.read_session() as session:
        title = session.execute(select(Audio.title).where(Audio.uuid == audio_uuid)).scalar_one()
    assert title == "Note"


def test_a_recording_restored_from_its_page_is_live_again(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    audio_uuid = _trashed(client, database, settings, accounts, owner_library, None)
    sign_in(client, "admin")
    assert client.post(f"/audio/{audio_uuid}/restore").status_code == status.HTTP_200_OK
    assert client.get(f"/audio/{audio_uuid}").json()["deleted_at"] is None
