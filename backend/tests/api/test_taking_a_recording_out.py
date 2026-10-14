"""Taking a recording out of a library needs Can manage (``DEC-27``, ``DAT-10``).

Ownership lives on the library, so a recording moved into a library its editor owns has changed
hands, and one sent to the trash is on its way out of everybody's. Both are now a manager's to do;
adding to a library is still an editor's.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from resonand.core.levels import Level
from resonand.db import libraries as library_repo
from resonand.db.audio import create_audio, share_audio
from resonand.db.engine import Database
from resonand.db.models import Library
from sqlalchemy import select

from tests.api.conftest import sign_in

HASH = "a" * 64


def _recording(database: Database, library_uuid: str, uploaded_by: int) -> str:
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.uuid == library_uuid)).scalar_one()
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=uploaded_by,
            storage_path="",
            original_filename="note.m4a",
            sha256=HASH,
        )
        return audio.uuid


def _grant(database: Database, owner: int, library_uuid: str, grantee: int, level: Level) -> None:
    with database.write_session() as session:
        library_repo.share_library(session, owner, library_uuid, grantee_id=grantee, level=level)


def _their_own(database: Database, owner: int) -> str:
    with database.write_session() as session:
        return library_repo.create_library(session, owner, name="Theirs").uuid


def _as(client: TestClient, name: str) -> None:
    client.delete("/auth/session")
    sign_in(client, name)


def test_an_editor_cannot_send_a_recording_to_the_trash(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    sign_in(client, "friend")
    assert client.delete(f"/audio/{uuid}").status_code == status.HTTP_403_FORBIDDEN
    assert client.get(f"/audio/{uuid}").json()["deleted_at"] is None


def test_an_editor_cannot_move_a_recording_into_a_library_of_their_own(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The move that hands a recording to whoever owns the library it lands in."""
    uuid = _recording(database, owner_library, accounts["admin"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    theirs = _their_own(database, accounts["friend"])
    sign_in(client, "friend")
    moved = client.post(f"/audio/{uuid}/move", json={"library_uuid": theirs})
    assert moved.status_code == status.HTTP_403_FORBIDDEN
    assert client.get(f"/audio/{uuid}").json()["library_uuid"] == owner_library


def test_an_editor_still_moves_a_recording_in(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Arriving needs edit on the destination and nothing more: it takes nothing from anybody."""
    theirs = _their_own(database, accounts["friend"])
    uuid = _recording(database, theirs, accounts["friend"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    sign_in(client, "friend")
    moved = client.post(f"/audio/{uuid}/move", json={"library_uuid": owner_library})
    assert moved.status_code == status.HTTP_200_OK
    assert moved.json()["level"] == Level.EDIT


def test_an_editor_is_not_shown_what_they_could_not_restore(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    sign_in(client, "admin")
    assert client.delete(f"/audio/{uuid}").status_code == status.HTTP_204_NO_CONTENT
    _as(client, "friend")
    assert client.get("/trash/audio").json()["total"] == 0
    assert client.post(f"/audio/{uuid}/restore").status_code == status.HTTP_403_FORBIDDEN
    assert client.delete(f"/trash/audio/{uuid}").status_code == status.HTTP_403_FORBIDDEN


def test_a_manager_takes_a_recording_out_every_way_there_is(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    kept = _recording(database, owner_library, accounts["admin"])
    moved = _recording(database, owner_library, accounts["admin"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.MANAGE)
    theirs = _their_own(database, accounts["friend"])
    sign_in(client, "friend")
    assert client.delete(f"/audio/{kept}").status_code == status.HTTP_204_NO_CONTENT
    assert client.get("/trash/audio").json()["total"] == 1
    assert client.post(f"/audio/{kept}/restore").status_code == status.HTTP_200_OK
    assert client.delete(f"/audio/{kept}").status_code == status.HTTP_204_NO_CONTENT
    assert client.delete(f"/trash/audio/{kept}").status_code == status.HTTP_204_NO_CONTENT
    answer = client.post(f"/audio/{moved}/move", json={"library_uuid": theirs})
    assert answer.status_code == status.HTTP_200_OK


def test_a_grant_at_manage_on_the_recording_alone_is_enough(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Manage resolves through the ACL like every other check, individual grants included."""
    uuid = _recording(database, owner_library, accounts["admin"])
    with database.write_session() as session:
        share_audio(
            session, accounts["admin"], uuid, grantee_id=accounts["friend"], level=Level.MANAGE
        )
    sign_in(client, "friend")
    assert client.delete(f"/audio/{uuid}").status_code == status.HTTP_204_NO_CONTENT


def test_a_duplicate_says_what_the_caller_may_do_with_it(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The upload dialog offers to restore a trashed copy, and only a manager may."""
    uuid = _recording(database, owner_library, accounts["admin"])
    _grant(database, accounts["admin"], owner_library, accounts["friend"], Level.EDIT)
    sign_in(client, "admin")
    client.delete(f"/audio/{uuid}")
    assert [one["level"] for one in client.get(f"/audio/duplicates/{HASH}").json()] == [Level.OWNER]
    _as(client, "friend")
    found = client.get(f"/audio/duplicates/{HASH}").json()
    assert [(one["in_trash"], one["level"]) for one in found] == [(True, Level.EDIT)]
