"""🧪 Search answers with the whole archive, not a slice of it (``BUG-1``).

Every one of these passed on the old code with three recordings in the fixture, which is why the
bug survived a suite that covers ranking, grouping, filtering and the ACL. It only appeared past
five hundred match rows -- the ceiling that existed so the matches could be grouped in Python --
and past it the failure was silent in the worst way: a plausible number, a plausible first page,
and two thirds of the archive missing.

So the fixture here is deliberately larger than that ceiling, and the assertions are about totals
and about which recordings come back rather than about any one result.
"""

from __future__ import annotations

import pytest
from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.search import Filters, search
from sonarium.db.transcripts import SegmentDraft

RECORDINGS = 160
SEGMENTS_EACH = 4
"""640 matching rows, comfortably past the five hundred that used to be fetched. Small enough that
building it costs a second."""

LONG_MS = 600_000
SHORT_MS = 60_000


@pytest.fixture
def crowded(database: Database) -> dict[str, int]:
    """An archive where one word matches every recording in it.

    Half are long and half are short, so a filter has something real to narrow to and the test
    can tell "the filter was applied" from "the filter matched everything".
    """
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Everything")
        for index in range(RECORDINGS):
            recording = create_audio(
                session,
                library_id=library.id,
                uploaded_by=owner.id,
                storage_path=f"storage/aa/{index}/original.m4a",
                original_filename=f"recording-{index}.m4a",
                title=f"Recording {index}",
            )
            recording.duration_ms = LONG_MS if index % 2 == 0 else SHORT_MS
            transcripts.create_transcript(
                session,
                recording.id,
                [
                    SegmentDraft(at * 1_000, (at + 1) * 1_000, "a word about the factory")
                    for at in range(SEGMENTS_EACH)
                ],
            )
        session.flush()
        return {"owner": owner.id}


def test_the_total_is_every_recording_that_matched(
    database: Database, crowded: dict[str, int]
) -> None:
    """The number under the search box is what paging is done against, so it has to be the truth.

    It used to be the count *after* truncation: the archive answered 100 for 300 and said it with
    a straight face.
    """
    with database.read_session() as session:
        hits, total = search(session, crowded["owner"], "factory", limit=20)

    assert total == RECORDINGS
    assert len(hits) == 20


def test_a_later_page_is_not_empty(database: Database, crowded: dict[str, int]) -> None:
    """Everything past the ceiling simply did not exist, however the caller asked for it."""
    with database.read_session() as session:
        hits, total = search(session, crowded["owner"], "factory", limit=20, offset=RECORDINGS - 10)

    assert total == RECORDINGS
    assert len(hits) == 10


def test_paging_through_reaches_every_recording_exactly_once(
    database: Database, crowded: dict[str, int]
) -> None:
    """The page was a slice of an unordered fetch, so a recording could be on two pages or none.

    Walking the whole result set and comparing it to the archive is the only assertion that
    catches both at once.
    """
    seen: list[int] = []
    with database.read_session() as session:
        for offset in range(0, RECORDINGS, 20):
            hits, _ = search(session, crowded["owner"], "factory", limit=20, offset=offset)
            seen.extend(hit.audio.id for hit in hits)

    assert len(seen) == RECORDINGS
    assert len(set(seen)) == RECORDINGS


def test_a_filter_narrows_what_matched_rather_than_what_was_fetched(
    database: Database, crowded: dict[str, int]
) -> None:
    """The filters ran over the survivors of the truncation, which made them quietly wrong.

    Half the archive is long, so the answer is exactly half -- a number the old order could not
    produce however the results happened to be ordered.
    """
    with database.read_session() as session:
        _, total = search(
            session,
            crowded["owner"],
            "factory",
            filters=Filters(min_duration_ms=LONG_MS),
            limit=20,
        )

    assert total == RECORDINGS // 2


def test_a_recording_still_carries_its_own_match_count(
    database: Database, crowded: dict[str, int]
) -> None:
    """``DEC-4``'s "+N more" is drawn from this, and it counts every match rather than the shown
    ones."""
    with database.read_session() as session:
        hits, _ = search(session, crowded["owner"], "factory", limit=1)

    assert hits[0].total_matches == SEGMENTS_EACH
    assert len(hits[0].matches) < SEGMENTS_EACH
