"""What the schema itself refuses (``DAT-1``).

Every test here defends a constraint that the first migration writes and that nothing later can
add cheaply. They go through raw SQL rather than the ORM on purpose: the subject is the database,
and putting a mapper between the assertion and the constraint would test the mapper.
"""

from __future__ import annotations

import pytest
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError

from tests.db.rows import (
    insert_audio,
    insert_category,
    insert_library,
    insert_segment,
    insert_transcript,
    insert_user,
)


def test_a_category_from_another_library_cannot_be_assigned(db_engine: Engine) -> None:
    """The composite foreign key is the only thing standing between the two libraries."""
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        mine = insert_library(connection, owner, name="Mine")
        theirs = insert_library(connection, owner, name="Theirs")
        foreign_category = insert_category(connection, theirs)
        with pytest.raises(IntegrityError):
            insert_audio(connection, mine, owner, category_id=foreign_category)


def test_a_category_from_the_same_library_is_accepted(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        category = insert_category(connection, library)
        assert insert_audio(connection, library, owner, category_id=category)


def test_two_root_categories_cannot_share_a_name(db_engine: Engine) -> None:
    """SQLite treats NULLs as distinct, which is why this index is partial rather than plain."""
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        insert_category(connection, library, name="Unit 1")
        with pytest.raises(IntegrityError):
            insert_category(connection, library, name="Unit 1")


def test_two_children_of_one_parent_cannot_share_a_name(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        parent = insert_category(connection, library, name="Unit 1")
        insert_category(connection, library, name="Lecture", parent_id=parent)
        with pytest.raises(IntegrityError):
            insert_category(connection, library, name="Lecture", parent_id=parent)


def test_the_same_name_under_two_different_parents_is_fine(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        first = insert_category(connection, library, name="Unit 1")
        second = insert_category(connection, library, name="Unit 2")
        insert_category(connection, library, name="Lecture", parent_id=first)
        assert insert_category(connection, library, name="Lecture", parent_id=second)


def test_one_recording_cannot_have_two_active_transcripts(db_engine: Engine) -> None:
    """JOB-7 re-transcribes into a new row; exactly one of them is the active one."""
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        insert_transcript(connection, audio, is_active=1)
        with pytest.raises(IntegrityError):
            insert_transcript(connection, audio, is_active=1)


def test_a_recording_may_keep_any_number_of_inactive_transcripts(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        insert_transcript(connection, audio, is_active=1)
        insert_transcript(connection, audio, is_active=0)
        assert insert_transcript(connection, audio, is_active=0)


@pytest.mark.parametrize(
    ("library_id", "audio_id"),
    [("NULL", "NULL"), ("1", "1")],
    ids=["neither", "both"],
)
def test_a_share_points_at_exactly_one_thing(
    db_engine: Engine, library_id: str, audio_id: str
) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        insert_audio(connection, library, owner)
        grantee = insert_user(connection, email="other@example.test")
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    f"INSERT INTO share (library_id, audio_id, grantee_id, level, granted_by, "  # noqa: S608
                    f"created_at) VALUES ({library_id}, {audio_id}, :grantee, 10, :granter, '')"
                ),
                {"grantee": grantee, "granter": owner},
            )


def test_ownership_is_not_a_grantable_level(db_engine: Engine) -> None:
    """Level 40 is read off library.owner_id, never written into a share row."""
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        grantee = insert_user(connection, email="other@example.test")
        with pytest.raises(IntegrityError):
            connection.execute(
                text(
                    "INSERT INTO share (library_id, grantee_id, level, granted_by, created_at) "
                    "VALUES (:library, :grantee, 40, :granter, '')"
                ),
                {"library": library, "grantee": grantee, "granter": owner},
            )


def test_two_casings_of_one_address_collide_on_the_key_not_the_display_form(
    db_engine: Engine,
) -> None:
    """DEC-15: UNIQUE on the typed address would make these two accounts."""
    with db_engine.begin() as connection:
        insert_user(connection, email="Gabriel@example.test")
        with pytest.raises(IntegrityError):
            insert_user(connection, email="gabriel@example.test")


def test_the_typed_form_may_repeat_when_the_key_does_not(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO user (email, email_normalised, display_name, created_at) "
                "VALUES ('a@x.test', 'a@x.test', 'A', '')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO user (email, email_normalised, display_name, created_at) "
                "VALUES ('a@x.test', 'b@x.test', 'B', '')"
            )
        )
        assert connection.execute(text("SELECT count(*) FROM user")).scalar_one() == 2


def test_a_segment_reaches_the_transcript_index_on_insert(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        transcript = insert_transcript(connection, audio)
        insert_segment(connection, transcript, 0, "the part about the factory")
        found = connection.execute(
            text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH 'factory'")
        ).scalar_one()
    assert found == 1


def test_an_edited_segment_is_findable_by_its_new_words_and_not_its_old_ones(
    db_engine: Engine,
) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        transcript = insert_transcript(connection, audio)
        segment = insert_segment(connection, transcript, 0, "the part about the factory")
        connection.execute(
            text("UPDATE segment SET text = 'the part about the harbour' WHERE id = :id"),
            {"id": segment},
        )
        matches = connection.execute(
            text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH :q"), {"q": "factory"}
        ).scalar_one()
        still_there = connection.execute(
            text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH :q"), {"q": "harbour"}
        ).scalar_one()
    assert matches == 0
    assert still_there == 1


def test_a_deleted_segment_leaves_the_transcript_index(db_engine: Engine) -> None:
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        transcript = insert_transcript(connection, audio)
        segment = insert_segment(connection, transcript, 0, "the part about the factory")
        connection.execute(text("DELETE FROM segment WHERE id = :id"), {"id": segment})
        found = connection.execute(
            text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH 'factory'")
        ).scalar_one()
    assert found == 0


def test_diacritics_do_not_hide_a_transcript_match(db_engine: Engine) -> None:
    """remove_diacritics 2 is what makes a query typed without accents find the accented word."""
    with db_engine.begin() as connection:
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        transcript = insert_transcript(connection, audio)
        insert_segment(connection, transcript, 0, "parlavem de la f\u00e0brica del poble")
        found = connection.execute(
            text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH :q"),
            {"q": "fabrica"},
        ).scalar_one()
    assert found == 1, "a query typed without accents must find the accented word"
