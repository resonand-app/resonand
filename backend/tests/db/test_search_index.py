"""The metadata index's write path (``DEC-13``, ``JOB-9``).

Search covers titles, notes and tags as well as transcripts, in one ranked list. That half of the
index is maintained by explicit writes rather than triggers, which means the property worth
defending is that a write actually happens -- and that a trashed recording leaves.
"""

from __future__ import annotations

from sonarium.db.engine import Database
from sonarium.db.search_index import index_audio, rebuild_all, remove_audio
from sqlalchemy import text

from tests.db.rows import insert_audio, insert_library, insert_tag, insert_user


def _matches(database: Database, query: str) -> int:
    with database.read_session() as session:
        return int(
            session.execute(
                text("SELECT count(*) FROM audio_fts WHERE audio_fts MATCH :q"), {"q": query}
            ).scalar_one()
        )


def test_a_title_is_findable(database: Database) -> None:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, title="Grandmother, third afternoon")
        index_audio(session, audio)
    assert _matches(database, "grandmother") == 1


def test_notes_are_findable(database: Database) -> None:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, notes="she talks about the factory")
        index_audio(session, audio)
    assert _matches(database, "factory") == 1


def test_a_tag_name_is_findable(database: Database) -> None:
    """The third of the projection that spans three tables, and the reason this is not a trigger."""
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner)
        insert_tag(connection, audio, "quantum physics", "quantum-physics")
        index_audio(session, audio)
    assert _matches(database, "quantum") == 1


def test_reindexing_replaces_rather_than_duplicates(database: Database) -> None:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, title="Grandmother")
        index_audio(session, audio)
        index_audio(session, audio)
    assert _matches(database, "grandmother") == 1


def test_a_retitled_recording_is_not_findable_by_its_old_title(database: Database) -> None:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, title="Untitled recording")
        index_audio(session, audio)
        connection.execute(
            text("UPDATE audio SET title = 'Grandmother' WHERE id = :id"), {"id": audio}
        )
        index_audio(session, audio)
    assert _matches(database, "untitled") == 0
    assert _matches(database, "grandmother") == 1


def test_a_trashed_recording_leaves_the_index(database: Database) -> None:
    """The ACL hides it anyway, so an indexed row would only be work spent on filtered results."""
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, title="Grandmother")
        index_audio(session, audio)
        connection.execute(
            text("UPDATE audio SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": audio},
        )
        index_audio(session, audio)
    assert _matches(database, "grandmother") == 0


def test_removing_a_recording_takes_it_out_of_the_index(database: Database) -> None:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(connection, library, owner, title="Grandmother")
        index_audio(session, audio)
        remove_audio(session, audio)
    assert _matches(database, "grandmother") == 0


def test_a_rebuild_covers_everything_that_was_never_indexed(database: Database) -> None:
    """What sonarium reindex is for: an archive whose index was lost or was never written."""
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        for index in range(3):
            insert_audio(connection, library, owner, title=f"Recording {index}")
    assert _matches(database, "recording") == 0
    with database.write_session() as session:
        covered = rebuild_all(session)
    assert covered == 3
    assert _matches(database, "recording") == 3


def test_a_metadata_match_can_produce_a_fragment(database: Database) -> None:
    """JOB-10 needs snippet() from both halves of the ranked list, which is why this table
    keeps its own copy rather than being external content."""
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection)
        library = insert_library(connection, owner)
        audio = insert_audio(
            connection, library, owner, notes="she explains what the factory used to be like"
        )
        index_audio(session, audio)
    with database.read_session() as session:
        fragment = session.execute(
            text(
                "SELECT snippet(audio_fts, 1, '<mark>', '</mark>', '...', 8) "
                "FROM audio_fts WHERE audio_fts MATCH :q"
            ),
            {"q": "factory"},
        ).scalar_one()
    assert "<mark>factory</mark>" in fragment
