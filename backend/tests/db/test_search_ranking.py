"""🧪 How a metadata match and a transcript match rank against each other (``REV-4a``).

Both sides are scored with ``bm25``, and for a long time that was the whole of the answer -- which
is not an answer, because two corpora scored with one function are still two corpora. What is
written down in ``db/search.py`` is the decision; these are the orderings it promises.

The fixtures are deliberately large. ``bm25`` clamps a non-positive IDF to nearly nothing, so on
the three-recording archive the rest of the search tests use, a word in one title and a word in
every title score the same -- and every ordering here would hold by accident.
"""

from __future__ import annotations

import pytest
from sonarium.db import libraries, search_index, tags, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Audio
from sonarium.db.search import search
from sonarium.db.transcripts import SegmentDraft
from sqlalchemy.orm import Session

FILLER_RECORDINGS = 80
"""Enough that a word in one title is unusual and a word in every title is not."""

SAID_THROUGHOUT = 30
"""Segments mentioning the term in the recording that is genuinely about it."""

LONG_TITLE = (
    "A long conversation recorded on a Tuesday afternoon at the old factory "
    "with several people and a great deal of background noise throughout"
)
NOTE_IN_A_SENTENCE = (
    "A long note about nothing much at all, in the middle of which we walked past the "
    "factory on the way back from the shops and said very little about it."
)


def _recording(session: Session, library_id: int, owner_id: int, index: int, title: str) -> Audio:
    return create_audio(
        session,
        library_id=library_id,
        uploaded_by=owner_id,
        storage_path=f"storage/aa/{index}/original.m4a",
        original_filename=f"recording-{index}.m4a",
        title=title,
    )


def _note(session: Session, recording: Audio, notes: str) -> None:
    recording.notes = notes
    session.flush()
    search_index.index_audio(session, recording.id)


def _said(session: Session, recording: Audio, times: int) -> None:
    transcripts.create_transcript(
        session,
        recording.id,
        [
            SegmentDraft(at * 10_000, at * 10_000 + 5_000, "the factory floor and the factory gate")
            for at in range(times)
        ],
    )


def _filler(
    session: Session, library_id: int, owner_id: int, title: str = "A walk in the garden"
) -> None:
    for index in range(FILLER_RECORDINGS):
        recording = _recording(session, library_id, owner_id, index, f"{title} {index}")
        transcripts.create_transcript(
            session,
            recording.id,
            [SegmentDraft(0, 5_000, "we talked about the weather and about the garden")],
        )


@pytest.fixture
def ranked(database: Database) -> dict[str, int]:
    """One word, rare in this archive, reached six different ways."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Everything")
        _filler(session, library.id, owner.id)

        named = _recording(session, library.id, owner.id, 901, "Factory tour")
        long_titled = _recording(session, library.id, owner.id, 902, LONG_TITLE)
        tagged = _recording(session, library.id, owner.id, 903, "Tuesday morning")
        tags.set_audio_tags(session, tagged.id, ["factory"])

        one_word_note = _recording(session, library.id, owner.id, 904, "Wednesday morning")
        _note(session, one_word_note, "factory")
        annotated = _recording(session, library.id, owner.id, 905, "Thursday morning")
        _note(session, annotated, NOTE_IN_A_SENTENCE)

        spoken = _recording(session, library.id, owner.id, 906, "Friday morning")
        _said(session, spoken, SAID_THROUGHOUT)
        mentioned = _recording(session, library.id, owner.id, 907, "Saturday morning")
        _said(session, mentioned, 1)

        session.flush()
        return {
            "owner": owner.id,
            "named": named.id,
            "long_titled": long_titled.id,
            "tagged": tagged.id,
            "one_word_note": one_word_note.id,
            "annotated": annotated.id,
            "spoken": spoken.id,
            "mentioned": mentioned.id,
        }


def _order(database: Database, user_id: int) -> list[int]:
    with database.read_session() as session:
        hits, _total = search(session, user_id, "factory", limit=50)
        return [hit.audio.id for hit in hits]


def test_the_recording_named_after_the_word_comes_first(
    database: Database, ranked: dict[str, int]
) -> None:
    """Somebody who called a recording *Factory tour* meant that word, and said so once."""
    order = _order(database, ranked["owner"])
    assert order[0] == ranked["named"]


def test_a_name_outranks_a_note_whatever_the_two_fields_happen_to_be_worth(
    database: Database, ranked: dict[str, int]
) -> None:
    """The one that fails without the column weights, and the reason they exist.

    Unweighted, ``bm25`` normalises by field length and nothing else, so which of two metadata
    matches came first was decided by how long each field happened to be: a one-word note beat a
    title of twenty-two words. Neither field is stronger evidence for being shorter.
    """
    order = _order(database, ranked["owner"])
    assert order.index(ranked["long_titled"]) < order.index(ranked["one_word_note"])
    assert order.index(ranked["long_titled"]) < order.index(ranked["annotated"])
    assert order.index(ranked["tagged"]) < order.index(ranked["annotated"])


def test_saying_a_word_throughout_beats_having_it_in_a_paragraph_of_notes(
    database: Database, ranked: dict[str, int]
) -> None:
    """The weights are weights and not tiers.

    ``bm25`` saturates, so weighting the naming fields heavily cannot lift every metadata match
    above every transcript one -- which is what keeps a recording that is genuinely about the word
    ahead of one that mentions it in the middle of a note. This is also the assertion a fixed
    multiplier between the two indexes breaks: at two, the passing mention wins.
    """
    order = _order(database, ranked["owner"])
    assert order.index(ranked["spoken"]) < order.index(ranked["annotated"])


def test_a_word_in_every_title_stops_being_evidence(database: Database) -> None:
    """The property that removes the need for a multiplier, stated on its own.

    Where every recording is called *factory* the title distinguishes nothing, and the IDF says so
    without being told: the metadata side scores near nothing and the recording the word is
    actually about comes first. A multiplier could not rescue that either -- a constant times
    nearly nothing is nearly nothing -- which is the point. What it would change is the ordering
    in the test above, and that is where it gets caught.
    """
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Everything")
        _filler(session, library.id, owner.id, title="Factory")
        spoken = _recording(session, library.id, owner.id, 901, "Factory 901")
        _said(session, spoken, SAID_THROUGHOUT)
        session.flush()
        owner_id, spoken_id = owner.id, spoken.id

    assert _order(database, owner_id)[0] == spoken_id
