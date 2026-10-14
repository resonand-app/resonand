"""Every recording you can see, filtered and sorted like a library (``API-27``)."""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from resonand.core.levels import Level
from resonand.db import libraries as library_repo
from resonand.db import tags as tag_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.db.models import Audio, Favourite, Library
from sqlalchemy import select, update

from tests.api.conftest import sign_in


def _library(database: Database, owner: int, name: str) -> str:
    with database.write_session() as session:
        return library_repo.create_library(session, owner, name=name).uuid


def _recording(
    database: Database,
    library_uuid: str,
    uploaded_by: int,
    title: str,
    *,
    duration_ms: int = 60_000,
    tags: tuple[str, ...] = (),
) -> str:
    with database.write_session() as session:
        library = session.execute(select(Library).where(Library.uuid == library_uuid)).scalar_one()
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=uploaded_by,
            storage_path="",
            original_filename=f"{title}.m4a",
            title=title,
        )
        audio.duration_ms = duration_ms
        if tags:
            tag_repo.set_audio_tags(session, audio.id, list(tags))
        return audio.uuid


def _marked_at(database: Database, audio_uuid: str, instant: str) -> None:
    """Pin when a mark was made, so an order by it does not rest on two writes' clock ticks."""
    with database.write_session() as session:
        audio_id = session.execute(select(Audio.id).where(Audio.uuid == audio_uuid)).scalar_one()
        session.execute(
            update(Favourite).where(Favourite.audio_id == audio_id).values(created_at=instant)
        )


def _titles(client: TestClient, **params: str | int) -> list[str]:
    response = client.get("/audio", params=params)
    assert response.status_code == status.HTTP_200_OK, response.text
    return [item["title"] for item in response.json()["items"]]


def test_the_filters_narrow_it(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    other = _library(database, accounts["admin"], "Elsewhere")
    _recording(database, owner_library, accounts["admin"], "Short", duration_ms=30_000)
    _recording(database, other, accounts["admin"], "Long", duration_ms=600_000, tags=("choir",))
    sign_in(client, "admin")
    assert _titles(client, tag="choir") == ["Long"]
    assert _titles(client, min_duration_ms=60_000) == ["Long"]
    assert _titles(client, transcription_state="none", sort="title", direction="asc") == [
        "Long",
        "Short",
    ]


def test_the_sort_and_its_direction_decide_the_order(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    for title, minutes in (("B", 3), ("A", 1), ("C", 2)):
        _recording(database, owner_library, accounts["admin"], title, duration_ms=minutes * 60_000)
    sign_in(client, "admin")
    assert _titles(client, sort="title", direction="asc") == ["A", "B", "C"]
    assert _titles(client, sort="duration_ms", direction="desc") == ["B", "C", "A"]


def test_two_pages_neither_repeat_nor_skip_a_recording(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Five recordings of one length: without a unique last key their order is SQLite's to pick."""
    for index in range(5):
        _recording(database, owner_library, accounts["admin"], f"Take {index}")
    sign_in(client, "admin")
    pages = [_titles(client, sort="duration_ms", limit=2, offset=offset) for offset in (0, 2, 4)]
    seen = [title for page in pages for title in page]
    assert sorted(seen) == [f"Take {index}" for index in range(5)]


def test_favourites_come_from_every_library_and_only_from_readable_ones(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    theirs = _library(database, accounts["friend"], "Theirs")
    own = _library(database, accounts["admin"], "Mine too")
    in_shared = _recording(database, theirs, accounts["friend"], "Shared with admin")
    in_own = _recording(database, own, accounts["admin"], "Admin's own")
    _recording(database, owner_library, accounts["admin"], "Never marked")
    with database.write_session() as session:
        library_repo.share_library(
            session, accounts["friend"], theirs, grantee_id=accounts["admin"], level=Level.READ
        )
    sign_in(client, "admin")
    client.put(f"/audio/{in_shared}/favourite")
    client.put(f"/audio/{in_own}/favourite")
    assert sorted(_titles(client, favourite="true")) == ["Admin's own", "Shared with admin"]
    with database.write_session() as session:
        library_repo.unshare_library(
            session, accounts["friend"], theirs, grantee_id=accounts["admin"]
        )
    assert _titles(client, favourite="true") == ["Admin's own"]


def test_favourites_are_ordered_by_when_they_were_marked(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    first = _recording(database, owner_library, accounts["admin"], "Marked first")
    second = _recording(database, owner_library, accounts["admin"], "Marked second")
    sign_in(client, "admin")
    client.put(f"/audio/{first}/favourite")
    client.put(f"/audio/{second}/favourite")
    _marked_at(database, first, "2026-01-01T09:00:00.000Z")
    _marked_at(database, second, "2026-02-01T09:00:00.000Z")
    assert _titles(client, favourite="true", sort="favourited_at") == [
        "Marked second",
        "Marked first",
    ]
    assert _titles(client, favourite="true", sort="favourited_at", direction="asc") == [
        "Marked first",
        "Marked second",
    ]


def test_ordering_by_when_it_was_marked_needs_the_favourite_filter(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    response = client.get("/audio", params={"sort": "favourited_at"})
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.headers["content-type"].startswith("application/problem+json")


def test_the_library_listing_and_search_take_the_favourite_filter_too(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    marked = _recording(database, owner_library, accounts["admin"], "Factory, marked")
    _recording(database, owner_library, accounts["admin"], "Factory, not marked")
    sign_in(client, "admin")
    client.put(f"/audio/{marked}/favourite")
    listed = client.get(f"/libraries/{owner_library}/audio", params={"favourite": "true"}).json()
    found = client.get("/search", params={"q": "factory", "favourite": "true"}).json()
    assert [item["title"] for item in listed["items"]] == ["Factory, marked"]
    assert [hit["audio"]["title"] for hit in found["items"]] == ["Factory, marked"]
