"""Grants made on one recording rather than on a library (``API-22``).

The resolution these ride on is ``tests/acl``'s subject and is not retested here. What is checked
is the half that is new: that the endpoints reach it, that a grant made here stays here -- it
reaches one recording and not the library around it -- and that the two kinds of access arrive in
one list saying which they are, because a panel that could not tell them apart would offer to
revoke something it cannot.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core.levels import Level
from sonarium.db import libraries as library_repo
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Share
from sqlalchemy import func, select

from tests.api.conftest import sign_in


def _recording(database: Database, library_uuid: str, owner_id: int) -> str:
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, owner_id)
            if row[0].uuid == library_uuid
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner_id,
            storage_path="storage/aa/one/original.m4a",
            original_filename="one.m4a",
        )
        return audio.uuid


def _individual_grants(database: Database) -> int:
    """How many grants in the whole archive are on a recording rather than on a library."""
    with database.read_session() as session:
        return int(
            session.execute(
                select(func.count(Share.id)).where(Share.audio_id.is_not(None))
            ).scalar_one()
        )


def test_a_grant_on_a_recording_does_not_make_its_library_visible(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The whole difference between this and a library share, so it is asserted first."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    granted = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.READ)},
    )
    assert granted.status_code == status.HTTP_200_OK

    sign_in(client, "friend")
    assert client.get(f"/audio/{audio}").status_code == status.HTTP_200_OK
    assert client.get(f"/libraries/{owner_library}").status_code == status.HTTP_404_NOT_FOUND
    assert owner_library not in [row["uuid"] for row in client.get("/libraries").json()]


def test_purging_a_recording_takes_its_grants_with_it(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``ON DELETE CASCADE`` rather than anything the application remembers to do.

    Asserted on the rows rather than through the API, because a 404 afterwards proves nothing:
    the recording is gone, so the resolution would answer that with the grant still sitting there.
    """
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(f"/audio/{audio}/shares", json={"grantee_id": accounts["friend"], "level": 10})
    assert _individual_grants(database) == 1

    assert client.delete(f"/audio/{audio}").status_code == status.HTTP_204_NO_CONTENT
    assert client.delete(f"/trash/audio/{audio}").status_code == status.HTTP_204_NO_CONTENT
    assert _individual_grants(database) == 0


def test_the_list_carries_both_kinds_and_says_which_is_which(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """One answer to "who has access", because there is only one question."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(
        f"/libraries/{owner_library}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.READ)},
    )
    client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["stranger"], "level": int(Level.EDIT)},
    )
    listed = client.get(f"/audio/{audio}/shares").json()
    assert [(row["grantee"]["id"], row["source"]) for row in listed] == [
        (accounts["friend"], "library"),
        (accounts["stranger"], "audio"),
    ]


def test_an_inherited_grant_cannot_be_revoked_from_the_recording(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """There is no denial row to write: the resolution is a ``MAX()`` and subtracts nothing."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(
        f"/libraries/{owner_library}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.READ)},
    )
    refused = client.delete(f"/audio/{audio}/shares/{accounts['friend']}")
    assert refused.status_code == status.HTTP_404_NOT_FOUND

    sign_in(client, "friend")
    assert client.get(f"/audio/{audio}").status_code == status.HTTP_200_OK


def test_an_editor_on_the_recording_cannot_share_it_onwards(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.EDIT)},
    )
    sign_in(client, "friend")
    refused = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["stranger"], "level": int(Level.READ)},
    )
    assert refused.status_code == status.HTTP_403_FORBIDDEN


def test_manage_obtained_on_the_recording_shares_onwards(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``DEC-25``: manage is manage however obtained, and ``granted_by`` keeps the chain legible."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.MANAGE)},
    )
    sign_in(client, "friend")
    onwards = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["stranger"], "level": int(Level.READ)},
    )
    assert onwards.status_code == status.HTTP_200_OK
    assert onwards.json()["granted_by"] == accounts["friend"]

    sign_in(client, "stranger")
    assert client.get(f"/audio/{audio}").status_code == status.HTTP_200_OK


def test_somebody_with_no_access_cannot_see_who_has(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(f"/audio/{audio}/shares", json={"grantee_id": accounts["friend"], "level": 10})
    sign_in(client, "stranger")
    assert client.get(f"/audio/{audio}/shares").status_code == status.HTTP_404_NOT_FOUND


def test_a_grant_on_the_recording_does_not_reveal_the_library_it_sits_in(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The whole point of granting one recording, asked of the endpoint that lists access.

    Every inherited row says ``library``, carries ``granted_by``, and names somebody who was
    never given this recording -- so answering a grantee at read would hand them the library they
    were deliberately not given. Manage is what the panel needs anyway.

    403 and not 404, which is ``require_audio``'s rule rather than this endpoint's: the caller is
    looking at the recording, so pretending it is not there would be a confusing lie.
    """
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    granted = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.READ)},
    )
    assert granted.status_code == status.HTTP_200_OK

    sign_in(client, "friend")
    assert client.get(f"/audio/{audio}").status_code == status.HTTP_200_OK
    assert client.get(f"/audio/{audio}/shares").status_code == status.HTTP_403_FORBIDDEN


def test_manage_on_the_recording_is_enough_to_list_access(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Manage however it was obtained (``DEC-25``), so the grantee's own panel can draw itself."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.MANAGE)},
    )
    sign_in(client, "friend")
    listed = client.get(f"/audio/{audio}/shares")
    assert listed.status_code == status.HTTP_200_OK
    assert [row["source"] for row in listed.json()] == ["audio"]


def test_the_owner_cannot_be_granted_their_own_recording(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    refused = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["admin"], "level": int(Level.READ)},
    )
    assert refused.status_code == status.HTTP_409_CONFLICT


def test_a_second_grant_raises_the_level_rather_than_adding_a_row(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``ux_share_audio`` would refuse the second row; the endpoint never offers it one."""
    audio = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.put(f"/audio/{audio}/shares", json={"grantee_id": accounts["friend"], "level": 10})
    raised = client.put(
        f"/audio/{audio}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.MANAGE)},
    )
    assert raised.status_code == status.HTTP_200_OK
    listed = client.get(f"/audio/{audio}/shares").json()
    assert [row["level"] for row in listed] == [int(Level.MANAGE)]
