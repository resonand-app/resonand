"""🧪 What a page of the archive costs to answer (``REV-2``, ``REV-3``).

Two separate faults with one symptom. Every list endpoint produced its ``total`` by building the
whole result set as ORM objects and taking the length of it, and the card presenter asked three
questions per card -- two halves of the transcription badge, and a library row that
``session.get`` does not serve from the identity map even when all fifty cards are in the same
library. Measured before this: 21 statements for five cards, 81 for twenty-five, 156 for fifty.

The assertions are about growth and not about any absolute number. A query split in two later is
not a regression; a page that costs more because the archive is larger is.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from resonand.db import libraries as library_repo
from resonand.db import tags as tag_repo
from resonand.db import transcripts
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.db.transcripts import SegmentDraft
from resonand.jobs import queue

from tests.api.conftest import sign_in, statements

RECORDINGS = 40
"""Enough that three statements per card would be unmistakable against a floor of six."""


@pytest.fixture
def crowded(database: Database, accounts: dict[str, int]) -> None:
    """One library of recordings in every state the badge distinguishes, and some tagged."""
    with database.write_session() as session:
        library = library_repo.create_library(session, accounts["admin"], name="Everything")
        for index in range(RECORDINGS):
            recording = create_audio(
                session,
                library_id=library.id,
                uploaded_by=accounts["admin"],
                storage_path=f"storage/aa/{index}/original.m4a",
                original_filename=f"recording-{index}.m4a",
            )
            recording.duration_ms = 60_000
            if index % 4 == 0:
                transcripts.create_transcript(
                    session, recording.id, [SegmentDraft(0, 5_000, "a word about the factory")]
                )
            elif index % 4 == 1:
                queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=recording.id)
            if index % 3 == 0:
                tag_repo.set_audio_tags(session, recording.id, ["kitchen"])


def _cost(database: Database, client: TestClient, path: str) -> int:
    with statements(database) as seen:
        response = client.get(path)
    assert response.status_code == 200
    return len(seen)


def test_a_page_of_cards_costs_the_same_whatever_is_on_it(
    database: Database, client: TestClient, crowded: None
) -> None:
    """The one that fails against the previous arrangement, by a factor of five."""
    sign_in(client, "admin")
    five = _cost(database, client, "/audio?limit=5")
    twenty_five = _cost(database, client, "/audio?limit=25")
    assert five == twenty_five


def test_the_total_is_counted_rather_than_built(
    database: Database, client: TestClient, crowded: None
) -> None:
    """``REV-2``: the envelope's ``total`` used to be ``len()`` over every readable recording.

    The count is asserted on the statement rather than on the answer, because both arrangements
    answer 40 and what differs is whether the work grows with the archive.
    """
    sign_in(client, "admin")
    with statements(database) as seen:
        body = client.get("/audio?limit=5").json()
    assert body["total"] == RECORDINGS
    assert len(body["items"]) == 5
    counted = [sql for sql in seen if "count(" in sql.lower()]
    assert counted, "the total was not asked of the database"


def test_the_sidebar_does_not_cost_a_query_per_library(
    database: Database, client: TestClient, accounts: dict[str, int]
) -> None:
    """``GET /libraries`` is not paginated, so its cost grew with what somebody has, not a page."""
    sign_in(client, "admin")
    one = _cost(database, client, "/libraries")
    with database.write_session() as session:
        for index in range(8):
            library_repo.create_library(session, accounts["admin"], name=f"Library {index}")
    nine = _cost(database, client, "/libraries")
    assert one == nine
