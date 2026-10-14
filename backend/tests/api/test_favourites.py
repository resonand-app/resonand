"""Marking a favourite over HTTP, and every recording saying whether it is one (``API-26``)."""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from resonand.core.levels import Level
from resonand.db import libraries as library_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.db.models import Favourite, Library
from sqlalchemy import func, select

from tests.api.conftest import sign_in


def _recording(database: Database, library_uuid: str, uploaded_by: int, title: str) -> str:
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.uuid == library_uuid)).scalar_one()
        return create_audio(
            session,
            library_id=library.id,
            uploaded_by=uploaded_by,
            storage_path="",
            original_filename=f"{title}.m4a",
            title=title,
        ).uuid


def _rows(database: Database) -> int:
    with database.read_session() as session:
        return session.execute(select(func.count()).select_from(Favourite)).scalar_one()


def _shared_with_friend(database: Database, accounts: dict[str, int], library_uuid: str) -> None:
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            library_uuid,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )


def test_marking_and_unmarking_answer_204_however_often(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"], "Kitchen, Sunday")
    sign_in(client, "admin")
    for _ in range(2):
        assert client.put(f"/audio/{uuid}/favourite").status_code == status.HTTP_204_NO_CONTENT
    assert _rows(database) == 1
    for _ in range(2):
        assert client.delete(f"/audio/{uuid}/favourite").status_code == status.HTTP_204_NO_CONTENT
    assert _rows(database) == 0


def test_reading_a_recording_is_enough_to_mark_it(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"], "Kitchen, Sunday")
    _shared_with_friend(database, accounts, owner_library)
    sign_in(client, "friend")
    assert client.put(f"/audio/{uuid}/favourite").status_code == status.HTTP_204_NO_CONTENT
    assert client.get(f"/audio/{uuid}").json()["is_favourite"] is True


def test_a_recording_nobody_shared_is_not_found_and_not_marked(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"], "Kitchen, Sunday")
    sign_in(client, "stranger")
    assert client.put(f"/audio/{uuid}/favourite").status_code == status.HTTP_404_NOT_FOUND
    assert client.delete(f"/audio/{uuid}/favourite").status_code == status.HTTP_404_NOT_FOUND
    assert _rows(database) == 0


def test_a_trashed_recording_is_not_found_and_not_marked(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"], "Kitchen, Sunday")
    sign_in(client, "admin")
    client.delete(f"/audio/{uuid}")
    assert client.put(f"/audio/{uuid}/favourite").status_code == status.HTTP_404_NOT_FOUND
    assert _rows(database) == 0


def test_the_mark_is_the_callers_and_nobody_elses(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The same recording, read by two accounts, says yes to the one that marked it only."""
    uuid = _recording(database, owner_library, accounts["admin"], "Kitchen, Sunday")
    _shared_with_friend(database, accounts, owner_library)
    sign_in(client, "admin")
    client.put(f"/audio/{uuid}/favourite")
    assert client.get(f"/audio/{uuid}").json()["is_favourite"] is True
    client.delete("/auth/session")
    sign_in(client, "friend")
    assert client.get(f"/audio/{uuid}").json()["is_favourite"] is False


def test_every_shape_a_recording_takes_carries_the_mark(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    marked = _recording(database, owner_library, accounts["admin"], "Factory, first shift")
    plain = _recording(database, owner_library, accounts["admin"], "Factory, second shift")
    sign_in(client, "admin")
    client.put(f"/audio/{marked}/favourite")

    def flags(items: list[dict[str, object]]) -> dict[object, object]:
        return {item["uuid"]: item["is_favourite"] for item in items}

    expected = {marked: True, plain: False}
    assert flags(client.get(f"/libraries/{owner_library}/audio").json()["items"]) == expected
    assert flags(client.get("/audio").json()["items"]) == expected
    hits = client.get("/search", params={"q": "factory"}).json()["items"]
    assert flags([hit["audio"] for hit in hits]) == expected
    assert client.get(f"/audio/{plain}").json()["is_favourite"] is False
