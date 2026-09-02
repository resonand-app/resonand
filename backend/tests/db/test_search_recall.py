"""The recall fixture (``JOB-14``).

``JOB-14`` is described in the plan as a decision to take rather than to discover, and this file
is where the decision is **measured** rather than assumed. It records, in executable form, exactly
which real queries against a real transcript succeed and which do not.

The decision taken: ``unicode61 remove_diacritics 2`` for accent-insensitivity, plus a prefix
wildcard on the final token, and **no stemming**. The cost is written down below rather than
discovered by a user: a query in one inflected form does not find another.

If the numbers here ever stop being acceptable -- most likely because the archive is mostly
Catalan or Spanish, where the inflected forms are where the queries land -- the change is a
secondary FTS5 ``trigram`` index for substring matching, at roughly three times the index size
and a slower write on every segment. That is a measurement away, not a rewrite.
"""

from __future__ import annotations

import pytest
from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.search import recall_note, search
from sonarium.db.transcripts import SegmentDraft

TRANSCRIPT = [
    "Treballava a la fàbrica des dels catorze anys",
    "My grandmother worked at the factory for thirty years",
    "Trabajaba en la fábrica desde muy joven",
]
"""Deliberately only singular and conjugated forms.

A fixture containing both the singular and the plural would make the negative cases below
pass for the wrong reason: they would be finding the plural directly rather than failing to
reach it from the singular, and the measurement would say nothing at all."""


@pytest.fixture
def archive(database: Database) -> int:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/1/original.m4a",
            original_filename="grandmother.m4a",
            title="Grandmother",
        )
        transcripts.create_transcript(
            session,
            audio.id,
            [
                SegmentDraft(index * 1000, index * 1000 + 900, line)
                for index, line in enumerate(TRANSCRIPT)
            ],
        )
        return owner.id


def _finds(database: Database, owner: int, query: str) -> bool:
    with database.read_session() as session:
        hits, _ = search(session, owner, query)
    return bool(hits)


@pytest.mark.parametrize(
    "query",
    [
        "fabrica",  # accents not typed -- remove_diacritics 2
        "fàbrica",  # accents typed
        "FABRICA",  # case
        "factory",  # exact
        "fact",  # prefix, while it is being typed
        "fábrica",  # a different accent on the same word
        "fabric",  # a prefix of fabrica
    ],
)
def test_what_the_search_does_find(database: Database, archive: int, query: str) -> None:
    assert _finds(database, archive, query), f"{query!r} should have matched"


@pytest.mark.parametrize(
    ("query", "why"),
    [
        ("fàbriques", "the plural does not find the singular: no stemming"),
        ("factories", "the English plural does not find the singular either"),
        ("treballar", "the infinitive does not find the conjugated form"),
    ],
)
def test_what_the_search_does_not_find_and_why(
    database: Database, archive: int, query: str, why: str
) -> None:
    """Written down as a passing test rather than left as a surprise.

    Each of these would start passing the day a trigram index is added, and this file is what
    would then have to be edited -- deliberately, in a diff somebody reviews.
    """
    assert not _finds(database, archive, query), f"{query!r} unexpectedly matched: {why}"


def test_the_singular_does_find_the_plural_because_of_the_prefix_wildcard(
    database: Database, archive: int
) -> None:
    """This is what the trailing wildcard actually buys, and it is worth knowing it is
    asymmetric: searching the shorter form finds the longer one, never the other way round."""
    assert _finds(database, archive, "fàbric")
    assert _finds(database, archive, "factor")


def test_the_limitation_is_stated_in_words_the_interface_can_show() -> None:
    note = recall_note()
    assert "accents" in note
    assert "other forms" in note
