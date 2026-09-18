"""🧪 Two endpoints answered a level nobody had resolved (``REV-S5``).

``upload`` reported ``owner`` for every recording it stored and ``restore_library`` reported
``owner`` for every library it took out of the trash, when both are reachable by somebody who is
not the owner: uploading needs edit, restoring needs manage.

The consequence is not cosmetic. The interface decides what to *offer* from that field --
``canShare`` in ``features/recording/data.ts``, the destinations in ``MoveDialog``, the libraries
in ``UploadDialog`` -- so a collaborator was offered sharing and deletion the API would then
refuse, which is a person finding out what they cannot do by being told no.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core.levels import Level
from sonarium.db.engine import Database

from tests.api.conftest import ClientFactory, sign_in


@pytest.fixture
def a_wav(tmp_path: Path) -> Path:
    """Any bytes with an accepted extension. Nothing here decodes them."""
    path = tmp_path / "note.wav"
    path.write_bytes(b"RIFF....WAVEfmt ")
    return path


def _granted(client: TestClient, library_uuid: str, grantee_id: int, level: Level) -> None:
    response = client.put(
        f"/libraries/{library_uuid}/shares", json={"grantee_id": grantee_id, "level": int(level)}
    )
    assert response.status_code in {200, 201}, response.text


def test_uploading_to_a_library_you_only_edit_reports_edit(
    client: TestClient,
    app_client_factory: ClientFactory,
    accounts: dict[str, int],
    owner_library: str,
    a_wav: Path,
) -> None:
    """Somebody with edit uploads, and is told what they actually hold."""
    sign_in(client, "admin")
    _granted(client, owner_library, accounts["friend"], Level.EDIT)

    friend = app_client_factory()
    sign_in(friend, "friend")
    with a_wav.open("rb") as handle:
        response = friend.post(
            f"/libraries/{owner_library}/audio",
            files={"file": (a_wav.name, handle, "audio/wav")},
        )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    assert response.json()["level"] == int(Level.EDIT)


def test_the_owner_uploading_is_still_told_they_own_it(
    client: TestClient, owner_library: str, a_wav: Path
) -> None:
    """The level is resolved rather than asserted, so the ordinary case has to still be right."""
    sign_in(client, "admin")
    with a_wav.open("rb") as handle:
        response = client.post(
            f"/libraries/{owner_library}/audio",
            files={"file": (a_wav.name, handle, "audio/wav")},
        )
    assert response.status_code == status.HTTP_201_CREATED, response.text
    assert response.json()["level"] == int(Level.OWNER)


def test_restoring_a_library_you_manage_reports_manage(
    client: TestClient,
    app_client_factory: ClientFactory,
    database: Database,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """Restoring needs manage, and manage is not ownership."""
    sign_in(client, "admin")
    _granted(client, owner_library, accounts["friend"], Level.MANAGE)

    friend = app_client_factory()
    sign_in(friend, "friend")
    assert friend.delete(f"/libraries/{owner_library}").status_code == status.HTTP_204_NO_CONTENT
    restored = friend.post(f"/libraries/{owner_library}/restore")
    assert restored.status_code == status.HTTP_200_OK, restored.text
    assert restored.json()["level"] == int(Level.MANAGE)


def test_creating_a_library_still_owns_it(client: TestClient, accounts: dict[str, int]) -> None:
    """The third ``Level.OWNER`` in that module is correct and stays."""
    sign_in(client, "admin")
    made = client.post("/libraries", json={"name": "Mine"})
    assert made.status_code == status.HTTP_201_CREATED, made.text
    assert made.json()["level"] == int(Level.OWNER)


def test_there_is_one_way_to_ask_whether_a_file_is_already_here(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """``REV-S2``: the same question had two endpoints in two router modules.

    The interface asks by hash and asks *before* the upload, which is the only ordering that can
    prevent one; the per-recording shape had no caller but its own mock.
    """
    sign_in(client, "admin")
    assert client.get("/audio/duplicates/" + "0" * 64).status_code == status.HTTP_200_OK
    document = client.get("/openapi.json").json()
    assert "/api/audio/duplicates/{sha256}" in document["paths"]
    assert "/api/audio/{audio_uuid}/duplicates" not in document["paths"]
