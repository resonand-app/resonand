"""Search (``JOB-10``, ``JOB-11``, ``JOB-14``).

The one test in here that would be a security incident if it failed is
``test_a_user_does_not_find_words_they_may_not_read``: search is the one place where the ACL has
to hold inside a query rather than around one, because a result count leaks just as much as a
result.
"""

from __future__ import annotations

import pytest
from resonand.core.levels import Level
from resonand.core.states import TranscriptionState
from resonand.db import libraries, tags, transcripts, users
from resonand.db.audio import create_audio, trash_audio
from resonand.db.engine import Database
from resonand.db.models import Audio
from resonand.db.search import (
    MATCH_METADATA,
    MATCH_TRANSCRIPT,
    SHOWN_PER_RECORDING,
    Filters,
    build_match_query,
    search,
)
from resonand.db.transcripts import SegmentDraft


@pytest.fixture
def archive(database: Database) -> dict[str, int]:
    """One owner, one reader who is shared nothing, and three recordings."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        stranger = users.create_user(session, email="s@x.test", display_name="S")
        library = libraries.create_library(session, owner.id, name="Family")

        interview = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/1/original.m4a",
            original_filename="grandmother.m4a",
            title="Grandmother, third afternoon",
        )
        interview.duration_ms = 2_400_000
        interview.recorded_at = "2024-03-11T18:22:00"
        tags.set_audio_tags(session, interview.id, ["oral history"])
        transcripts.create_transcript(
            session,
            interview.id,
            [
                SegmentDraft(0, 5_000, "She starts by talking about the village"),
                SegmentDraft(600_000, 605_000, "and then about the factory"),
                SegmentDraft(1_200_000, 1_205_000, "the factory closed in the eighties"),
                SegmentDraft(1_800_000, 1_805_000, "everybody worked at the factory"),
                SegmentDraft(2_000_000, 2_005_000, "the factory again, for good measure"),
            ],
        )

        note = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/2/original.opus",
            original_filename="note.opus",
            title="A note about the factory",
        )
        note.duration_ms = 60_000
        note.recorded_at = "2020-01-01T09:00:00"

        session.flush()
        return {"owner": owner.id, "stranger": stranger.id, "interview": interview.id}


# --- The rule that matters ------------------------------------------------


def test_a_user_does_not_find_words_they_may_not_read(
    database: Database, archive: dict[str, int]
) -> None:
    """The mandatory test. A result count leaks as much as a result."""
    with database.read_session() as session:
        hits, total = search(session, archive["stranger"], "factory")
    assert hits == []
    assert total == 0


def test_the_owner_finds_them(database: Database, archive: dict[str, int]) -> None:
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "factory")
    assert hits


def test_a_shared_library_makes_its_transcripts_findable(
    database: Database, archive: dict[str, int]
) -> None:
    with database.write_session() as session:
        library = libraries.list_libraries(session, archive["owner"])[1][0]
        libraries.share_library(
            session,
            archive["owner"],
            library.uuid,
            grantee_id=archive["stranger"],
            level=Level.READ,
        )
    with database.read_session() as session:
        hits, _ = search(session, archive["stranger"], "factory")
    assert hits


def test_a_trashed_recording_is_not_in_the_results(
    database: Database, archive: dict[str, int]
) -> None:
    with database.write_session() as session:
        row = session.get(Audio, archive["interview"])
        assert row is not None
        trash_audio(session, archive["owner"], row.uuid)
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "factory")
    assert all(hit.audio.id != archive["interview"] for hit in hits)


# --- One ranked list over both indexes ------------------------------------


def test_a_transcript_match_carries_the_moment_to_play_from(
    database: Database, archive: dict[str, int]
) -> None:
    """A result you cannot play from is a search result you have to go and look for again."""
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "village")
    match = hits[0].matches[0]
    assert match.kind == MATCH_TRANSCRIPT
    assert match.start_ms == 0


def test_a_title_match_is_in_the_same_list_as_a_transcript_match(
    database: Database, archive: dict[str, int]
) -> None:
    """DEC-13. Titles, notes and tags were promised and only transcripts had an index."""
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "factory")
    kinds = {match.kind for hit in hits for match in hit.matches}
    assert MATCH_METADATA in kinds
    assert MATCH_TRANSCRIPT in kinds


def test_a_tag_name_is_searchable(database: Database, archive: dict[str, int]) -> None:
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "oral")
    assert hits


def test_every_match_comes_with_the_words_around_it(
    database: Database, archive: dict[str, int]
) -> None:
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "village")
    assert "<mark>" in hits[0].matches[0].fragment


# --- Grouping (DEC-4) -----------------------------------------------------


def test_matches_are_grouped_under_their_recording(
    database: Database, archive: dict[str, int]
) -> None:
    """A flat list lets one long interview bury everything else."""
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "factory")
    interview = next(hit for hit in hits if hit.audio.id == archive["interview"])
    assert interview.total_matches >= 4
    assert len(interview.matches) == SHOWN_PER_RECORDING, "three shown, the rest behind +N more"


def test_one_recording_appears_once_however_many_times_it_matches(
    database: Database, archive: dict[str, int]
) -> None:
    with database.read_session() as session:
        hits, total = search(session, archive["owner"], "factory")
    assert len({hit.audio.id for hit in hits}) == len(hits)
    assert total == len(hits)


# --- What somebody typed --------------------------------------------------


@pytest.mark.parametrize(
    "query",
    ['factory"', "factory*", "NOT factory", "-factory", "(factory)", "^", '"', "* *"],
)
def test_an_operator_somebody_typed_is_not_a_syntax_error(
    database: Database, archive: dict[str, int], query: str
) -> None:
    """Somebody searching for a hyphenated name is not writing a query language, and an
    unescaped operator is a syntax error thrown at a person who typed a name."""
    with database.read_session() as session:
        search(session, archive["owner"], query)


@pytest.mark.parametrize("query", ['factory"', "factory*", "-factory", "(factory)"])
def test_punctuation_around_a_word_does_not_stop_it_matching(
    database: Database, archive: dict[str, int], query: str
) -> None:
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], query)
    assert hits


def test_a_word_that_looks_like_an_operator_is_searched_for_as_a_word(
    database: Database, archive: dict[str, int]
) -> None:
    """NOT is not an operator here: it is a word, and no recording says it."""
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "NOT factory")
    assert hits == []


def test_an_empty_query_finds_nothing_rather_than_everything(
    database: Database, archive: dict[str, int]
) -> None:
    with database.read_session() as session:
        assert search(session, archive["owner"], "   ") == ([], 0)


def test_the_last_word_matches_as_a_prefix_while_it_is_being_typed(
    database: Database, archive: dict[str, int]
) -> None:
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "fact")
    assert hits, "JOB-14: a prefix wildcard on the trailing token"


def test_accents_do_not_have_to_be_typed(database: Database, archive: dict[str, int]) -> None:
    with database.write_session() as session:
        row = session.get(Audio, archive["interview"])
        assert row is not None
        transcripts.create_transcript(
            session, row.id, [SegmentDraft(0, 1_000, "la fàbrica del poble")]
        )
    with database.read_session() as session:
        hits, _ = search(session, archive["owner"], "fabrica")
    assert hits


def test_the_query_builder_quotes_tokens_and_wildcards_the_last() -> None:
    assert build_match_query("the factory") == '"the" "factory"*'
    assert build_match_query("") == ""


# --- Filters (JOB-11) -----------------------------------------------------


def test_a_search_can_be_narrowed_to_one_library(
    database: Database, archive: dict[str, int]
) -> None:
    with database.write_session() as session:
        elsewhere = libraries.create_library(session, archive["owner"], name="Elsewhere")
        other_uuid = elsewhere.uuid
    with database.read_session() as session:
        hits, _ = search(
            session, archive["owner"], "factory", filters=Filters(library_uuid=other_uuid)
        )
    assert hits == []


def test_a_search_can_be_narrowed_by_duration(database: Database, archive: dict[str, int]) -> None:
    with database.read_session() as session:
        long_ones, _ = search(
            session, archive["owner"], "factory", filters=Filters(min_duration_ms=600_000)
        )
        short_ones, _ = search(
            session, archive["owner"], "factory", filters=Filters(max_duration_ms=120_000)
        )
    assert [hit.audio.id for hit in long_ones] == [archive["interview"]]
    assert archive["interview"] not in [hit.audio.id for hit in short_ones]


def test_a_search_can_be_narrowed_by_when_it_was_recorded(
    database: Database, archive: dict[str, int]
) -> None:
    """The wall-clock strings sort as text, which is what makes this a plain comparison."""
    with database.read_session() as session:
        recent, _ = search(
            session,
            archive["owner"],
            "factory",
            filters=Filters(recorded_from="2024-01-01T00:00:00"),
        )
    assert [hit.audio.id for hit in recent] == [archive["interview"]]


def test_a_search_can_be_narrowed_by_tag(database: Database, archive: dict[str, int]) -> None:
    with database.read_session() as session:
        tagged, _ = search(
            session, archive["owner"], "factory", filters=Filters(tag_slugs=("oral-history",))
        )
    assert [hit.audio.id for hit in tagged] == [archive["interview"]]


def test_a_search_can_be_narrowed_to_what_has_no_transcript(
    database: Database, archive: dict[str, int]
) -> None:
    with database.read_session() as session:
        untranscribed, _ = search(
            session,
            archive["owner"],
            "factory",
            filters=Filters(transcription_states=(TranscriptionState.NONE,)),
        )
    assert archive["interview"] not in [hit.audio.id for hit in untranscribed]
