"""Favourites (``DAT-11``): a mark one account puts on a recording it can read, for nobody else."""

from __future__ import annotations

from dataclasses import dataclass

import pytest
from resonand.acl.query import audio_select
from resonand.core.errors import NotFoundError
from resonand.core.levels import Level
from resonand.db import favourites, libraries, users
from resonand.db.audio import create_audio, purge_audio, restore_audio, trash_audio
from resonand.db.engine import Database
from resonand.db.models import Favourite, Library, User
from resonand.db.search import Filters, apply_filters, search
from sqlalchemy import delete, func, select


@dataclass(frozen=True)
class World:
    owner: int
    reader: int
    stranger: int
    shared: str
    """A library the owner shares with the reader, read-only."""
    in_shared: str
    in_own: str
    """A recording in a library of the reader's own."""
    in_private: str
    """A recording in a library of the owner's that nobody else can see."""


@pytest.fixture
def world(database: Database) -> World:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        reader = users.create_user(session, email="r@x.test", display_name="R")
        stranger = users.create_user(session, email="s@x.test", display_name="S")
        shared = libraries.create_library(session, owner.id, name="Family")
        private = libraries.create_library(session, owner.id, name="Private")
        own = libraries.create_library(session, reader.id, name="Mine")
        libraries.share_library(
            session, owner.id, shared.uuid, grantee_id=reader.id, level=Level.READ
        )

        def recording(library_id: int, uploaded_by: int, title: str) -> str:
            return create_audio(
                session,
                library_id=library_id,
                uploaded_by=uploaded_by,
                storage_path="",
                original_filename=f"{title}.m4a",
                title=title,
            ).uuid

        return World(
            owner=owner.id,
            reader=reader.id,
            stranger=stranger.id,
            shared=shared.uuid,
            in_shared=recording(shared.id, owner.id, "Grandmother, factory years"),
            in_own=recording(own.id, reader.id, "Choir, factory hall"),
            in_private=recording(private.id, owner.id, "Private note"),
        )


def _favourites(database: Database, user_id: int) -> set[str]:
    """What the account sees as its favourites: the shared filter over the readable set."""
    with database.read_session() as session:
        query = apply_filters(audio_select(user_id), Filters(favourite_of=user_id))
        return {row[0].uuid for row in session.execute(query).all()}


def _rows(database: Database) -> int:
    with database.read_session() as session:
        return session.execute(select(func.count()).select_from(Favourite)).scalar_one()


def _mark(database: Database, user_id: int, audio_uuid: str) -> None:
    with database.write_session() as session:
        favourites.mark(session, user_id, audio_uuid)


def test_marking_twice_leaves_one_mark(database: Database, world: World) -> None:
    _mark(database, world.reader, world.in_shared)
    _mark(database, world.reader, world.in_shared)
    assert _rows(database) == 1


def test_unmarking_what_was_never_marked_is_not_an_error(database: Database, world: World) -> None:
    _mark(database, world.reader, world.in_shared)
    with database.write_session() as session:
        favourites.unmark(session, world.reader, world.in_shared)
        favourites.unmark(session, world.reader, world.in_shared)
    assert _rows(database) == 0


def test_a_recording_the_caller_cannot_read_is_not_found_and_not_marked(
    database: Database, world: World
) -> None:
    with database.write_session() as session, pytest.raises(NotFoundError):
        favourites.mark(session, world.reader, world.in_private)
    assert _rows(database) == 0


def test_reading_is_enough_to_mark(database: Database, world: World) -> None:
    """The mark belongs to the person making it and asks nothing of the recording."""
    _mark(database, world.reader, world.in_shared)
    assert _favourites(database, world.reader) == {world.in_shared}


def test_favourites_span_libraries_and_belong_to_one_account(
    database: Database, world: World
) -> None:
    _mark(database, world.reader, world.in_shared)
    _mark(database, world.reader, world.in_own)
    _mark(database, world.owner, world.in_private)
    assert _favourites(database, world.reader) == {world.in_shared, world.in_own}
    assert _favourites(database, world.owner) == {world.in_private}
    assert _favourites(database, world.stranger) == set()


def test_search_narrows_to_favourites_through_the_same_filter(
    database: Database, world: World
) -> None:
    _mark(database, world.reader, world.in_own)
    with database.read_session() as session:
        hits, total = search(
            session, world.reader, "factory", filters=Filters(favourite_of=world.reader)
        )
    assert ([hit.audio.uuid for hit in hits], total) == ([world.in_own], 1)


def test_losing_access_hides_a_favourite_and_regaining_it_brings_it_back(
    database: Database, world: World
) -> None:
    _mark(database, world.reader, world.in_shared)
    with database.write_session() as session:
        libraries.unshare_library(session, world.owner, world.shared, grantee_id=world.reader)
    assert _favourites(database, world.reader) == set()
    assert _rows(database) == 1, "kept, and hidden by the ACL rather than deleted"
    with database.write_session() as session:
        libraries.share_library(
            session, world.owner, world.shared, grantee_id=world.reader, level=Level.READ
        )
    assert _favourites(database, world.reader) == {world.in_shared}


def test_the_trash_hides_a_favourite_and_restoring_brings_it_back(
    database: Database, world: World
) -> None:
    _mark(database, world.reader, world.in_own)
    with database.write_session() as session:
        trash_audio(session, world.reader, world.in_own)
    assert _favourites(database, world.reader) == set()
    with database.write_session() as session:
        restore_audio(session, world.reader, world.in_own)
    assert _favourites(database, world.reader) == {world.in_own}


def test_a_trashed_recording_cannot_be_marked(database: Database, world: World) -> None:
    with database.write_session() as session:
        trash_audio(session, world.reader, world.in_own)
    with database.write_session() as session, pytest.raises(NotFoundError):
        favourites.mark(session, world.reader, world.in_own)


def test_purging_a_recording_takes_its_marks_with_it(database: Database, world: World) -> None:
    _mark(database, world.reader, world.in_own)
    with database.write_session() as session:
        trash_audio(session, world.reader, world.in_own)
        purge_audio(session, world.reader, world.in_own)
    assert _rows(database) == 0


def test_deleting_an_account_takes_its_marks_with_it(database: Database, world: World) -> None:
    """As the administrator's delete does it: the empty libraries first, then the account."""
    with database.write_session() as session:
        libraries.share_library(
            session, world.owner, world.shared, grantee_id=world.stranger, level=Level.READ
        )
    _mark(database, world.stranger, world.in_shared)
    _mark(database, world.owner, world.in_shared)
    with database.write_session() as session:
        session.execute(delete(Library).where(Library.owner_id == world.stranger))
        session.execute(delete(User).where(User.id == world.stranger))
    with database.read_session() as session:
        left = session.execute(select(Favourite.user_id)).scalars().all()
    assert left == [world.owner]
