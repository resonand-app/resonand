"""Filtering and sorting a library's recordings (``API-10``).

``GET /libraries/{uuid}/audio`` took only ``limit`` and ``offset``, newest first, which left
``UI-8``'s whole filter bar and ``UI-7d``'s column sort with nothing behind them. The property
worth defending here is that the filter bar means the same thing on the grid as it does in
search -- they go through one dependency and one ``apply_filters`` -- and that a sort is stable,
because a list somebody scrolls must not shuffle underneath them.
"""

from __future__ import annotations

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from resonand.db import libraries as library_repo
from resonand.db import tags as tag_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database

from tests.api.conftest import sign_in

RECORDINGS = [
    # title, recorded_at, duration_ms
    ("Grandmother", "2024-03-11T18:22:00", 2_400_000),
    ("The factory", "2020-01-01T09:00:00", 60_000),
    ("A walk", None, 60_000),
    ("Birthday", "2022-07-04T12:00:00", 900_000),
]


@pytest.fixture
def filled_library(database: Database, accounts: dict[str, int], owner_library: str) -> str:
    """Four recordings that differ in every sortable field, one with no recording date."""
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, accounts["admin"])
            if row[0].uuid == owner_library
        )
        for title, recorded_at, duration_ms in RECORDINGS:
            audio = create_audio(
                session,
                library_id=library.id,
                uploaded_by=accounts["admin"],
                storage_path=f"aa/{title}/original.m4a",
                original_filename=f"{title}.m4a",
                title=title,
            )
            audio.recorded_at = recorded_at
            audio.duration_ms = duration_ms
            session.flush()
            if title == "Grandmother":
                tag_repo.set_audio_tags(session, audio.id, ["oral history"])
    return owner_library


def _titles(client: TestClient, library: str, **params: str | int) -> list[str]:
    listed = client.get(f"/libraries/{library}/audio", params=params).json()
    return [row["title"] for row in listed["items"]]


# --- Sorting -------------------------------------------------------------


def test_the_default_is_still_the_most_recently_recorded_first(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """Unchanged behaviour, asserted so that adding the parameters did not quietly move it."""
    sign_in(client, "admin")
    assert _titles(client, filled_library)[:3] == ["Grandmother", "Birthday", "The factory"]


@pytest.mark.parametrize(
    ("sort", "ascending", "descending"),
    [
        # "A walk" has no recording date, so it is last in both directions rather than first
        # in one of them.
        (
            "recorded_at",
            ["The factory", "Birthday", "Grandmother", "A walk"],
            ["Grandmother", "Birthday", "The factory", "A walk"],
        ),
        # "The factory" and "A walk" are both a minute long; the tiebreaker decides, and it
        # reverses with the sort.
        (
            "duration_ms",
            ["The factory", "A walk", "Birthday", "Grandmother"],
            ["Grandmother", "Birthday", "A walk", "The factory"],
        ),
        (
            "title",
            ["A walk", "Birthday", "Grandmother", "The factory"],
            ["The factory", "Grandmother", "Birthday", "A walk"],
        ),
        (
            "created_at",
            ["Grandmother", "The factory", "A walk", "Birthday"],
            ["Birthday", "A walk", "The factory", "Grandmother"],
        ),
    ],
)
def test_every_sort_field_works_in_both_directions(
    client: TestClient,
    accounts: dict[str, int],
    filled_library: str,
    sort: str,
    ascending: list[str],
    descending: list[str],
) -> None:
    sign_in(client, "admin")
    assert _titles(client, filled_library, sort=sort, direction="asc") == ascending
    assert _titles(client, filled_library, sort=sort, direction="desc") == descending


def test_a_recording_with_no_date_is_not_treated_as_the_oldest(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """A missing recording date means *unknown*, not 1970. Sorting it to either end of the
    archive would be an answer the data does not support, so it goes last both ways."""
    sign_in(client, "admin")
    assert _titles(client, filled_library, sort="recorded_at", direction="asc")[-1] == "A walk"
    assert _titles(client, filled_library, sort="recorded_at", direction="desc")[-1] == "A walk"


def test_a_sort_is_stable_across_pages(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """Two recordings of the same duration have no order between them unless one is imposed.

    Without the tiebreaker SQLite is free to return them differently on each page, which shows up
    as a row appearing twice while somebody scrolls: unreproducible, and it looks like data loss.
    """
    sign_in(client, "admin")
    whole = _titles(client, filled_library, sort="duration_ms", direction="asc")
    paged = []
    for offset in range(0, len(whole), 2):
        paged += _titles(
            client, filled_library, sort="duration_ms", direction="asc", limit=2, offset=offset
        )
    assert paged == whole


def test_a_sort_field_that_does_not_exist_is_refused(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    sign_in(client, "admin")
    refused = client.get(f"/libraries/{filled_library}/audio", params={"sort": "loudness"})
    assert refused.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


# --- Filtering -----------------------------------------------------------


def test_the_grid_filters_by_tag(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    sign_in(client, "admin")
    assert _titles(client, filled_library, tag="oral-history") == ["Grandmother"]


def test_the_grid_filters_by_duration_and_date_range(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    sign_in(client, "admin")
    assert _titles(client, filled_library, min_duration_ms=100_000) == ["Grandmother", "Birthday"]
    assert _titles(client, filled_library, recorded_from="2021-01-01T00:00:00") == [
        "Grandmother",
        "Birthday",
    ]


def test_the_grid_filters_by_transcription_state(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """``JOB-11b``'s four states, on the grid rather than in search."""
    sign_in(client, "admin")
    assert set(_titles(client, filled_library, transcription_state="none")) == {
        title for title, _, _ in RECORDINGS
    }
    assert _titles(client, filled_library, transcription_state="done") == []


def test_the_total_counts_what_matches_rather_than_what_is_there(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """``UI-7a`` draws a scrollbar from ``total`` before the first page arrives, so a filtered
    total that counted the whole library would size it wrongly."""
    sign_in(client, "admin")
    filtered = client.get(
        f"/libraries/{filled_library}/audio", params={"min_duration_ms": 100_000}
    ).json()
    assert filtered["total"] == 2


def test_a_filter_selects_the_same_recordings_here_as_in_search(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """The reason both go through one dependency: a filter that meant two things in two places
    is what ``UI-8c`` is written against."""
    sign_in(client, "admin")
    on_the_grid = _titles(client, filled_library, tag="oral-history")
    in_search = [
        row["audio"]["title"]
        for row in client.get(
            "/search",
            params={"q": "grandmother", "library": filled_library, "tag": "oral-history"},
        ).json()["items"]
    ]
    assert on_the_grid == in_search == ["Grandmother"]


def test_filtering_does_not_reach_past_the_acl(
    client: TestClient, accounts: dict[str, int], filled_library: str
) -> None:
    """A filter is a narrowing, never a widening."""
    sign_in(client, "stranger")
    refused = client.get(f"/libraries/{filled_library}/audio", params={"tag": "oral-history"})
    assert refused.status_code == status.HTTP_404_NOT_FOUND
