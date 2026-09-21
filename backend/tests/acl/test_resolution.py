"""The permission matrix (``DAT-3``).

The most important test in the repository. Everything the application will ever show anybody goes
through the query these tests describe, so a hole here is not a bug in one endpoint -- it is a
hole in every endpoint at once, including the ones not written yet.

Individual sharing has no interface in v0. It is tested from day one anyway, because the
resolution ships now and retrofitting a permission rule to an archive that already has data in it
is not something anybody gets to do carefully.
"""

from __future__ import annotations

import pytest
from resonand.acl.query import (
    audio_level,
    audio_select,
    library_select,
    readable_audio_ids,
    require_audio,
    require_library,
)
from resonand.core.errors import NotFoundError, PermissionDeniedError
from resonand.core.levels import Level
from resonand.db.engine import Database
from resonand.db.models import Audio, Library
from sqlalchemy import select, text

from tests.acl.conftest import Archive, Grant
from tests.db.rows import insert_audio, insert_library, insert_user


def _uuid_of_audio(database: Database, audio_id: int) -> str:
    with database.read_session() as session:
        return str(session.execute(select(Audio.uuid).where(Audio.id == audio_id)).scalar_one())


def _uuid_of_library(database: Database, library_id: int) -> str:
    with database.read_session() as session:
        return str(
            session.execute(select(Library.uuid).where(Library.id == library_id)).scalar_one()
        )


def _level(database: Database, user_id: int, audio_id: int) -> Level | None:
    with database.read_session() as session:
        return audio_level(session, user_id, _uuid_of_audio(database, audio_id))


# --- The four ways to hold a level ----------------------------------------


def test_the_owner_of_the_library_owns_everything_in_it(
    database: Database, archive: Archive
) -> None:
    """Ownership lives on the library, not on the recording -- so a collaborator's upload is
    not ambiguous, and transferring ownership is one UPDATE rather than a walk over thousands."""
    assert _level(database, archive.owner, archive.audio) is Level.OWNER


@pytest.mark.parametrize(
    ("who", "expected"),
    [("reader", Level.READ), ("editor", Level.EDIT), ("manager", Level.MANAGE)],
)
def test_a_library_grant_reaches_the_recordings_in_it(
    database: Database, archive: Archive, who: str, expected: Level
) -> None:
    assert _level(database, getattr(archive, who), archive.audio) is expected


def test_a_grant_on_one_recording_reaches_only_that_recording(
    database: Database, archive: Archive, share: Grant
) -> None:
    share(
        granter=archive.owner,
        grantee=archive.stranger,
        level=Level.READ,
        audio_id=archive.private_audio,
    )
    assert _level(database, archive.stranger, archive.private_audio) is Level.READ
    assert _level(database, archive.stranger, archive.audio) is None


def test_a_stranger_holds_nothing(database: Database, archive: Archive) -> None:
    assert _level(database, archive.stranger, archive.audio) is None


# --- The highest permission wins ------------------------------------------


def test_two_grants_resolve_to_the_higher_one(
    database: Database, archive: Archive, share: Grant
) -> None:
    """The scalar MAX() is the rule, not an application-layer comparison that could disagree."""
    share(
        granter=archive.owner,
        grantee=archive.reader,
        level=Level.MANAGE,
        audio_id=archive.audio,
    )
    assert _level(database, archive.reader, archive.audio) is Level.MANAGE


def test_a_lower_individual_grant_never_reduces_a_library_grant(
    database: Database, archive: Archive, share: Grant
) -> None:
    """A share is a grant, never a restriction. Somebody who can manage the library does not
    lose that because a recording in it was also shared with them at read."""
    share(granter=archive.owner, grantee=archive.manager, level=Level.READ, audio_id=archive.audio)
    assert _level(database, archive.manager, archive.audio) is Level.MANAGE


def test_the_owner_stays_the_owner_whatever_else_is_granted(
    database: Database, archive: Archive, share: Grant
) -> None:
    share(granter=archive.owner, grantee=archive.owner, level=Level.READ, audio_id=archive.audio)
    assert _level(database, archive.owner, archive.audio) is Level.OWNER


# --- Deletion -------------------------------------------------------------


def test_a_trashed_recording_disappears_for_everybody(database: Database, archive: Archive) -> None:
    with database.write_session() as session:
        session.execute(
            text("UPDATE audio SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": archive.audio},
        )
    assert _level(database, archive.owner, archive.audio) is None
    assert _level(database, archive.reader, archive.audio) is None


def test_a_deleted_library_takes_its_recordings_with_it(
    database: Database, archive: Archive
) -> None:
    """Deleting a library is trash too, not a CASCADE: deleted_at hides it and touches nothing."""
    with database.write_session() as session:
        session.execute(
            text("UPDATE library SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": archive.library},
        )
    assert _level(database, archive.owner, archive.audio) is None
    assert _level(database, archive.reader, archive.audio) is None


def test_the_trash_view_sees_what_was_deleted_without_a_second_permission_query(
    database: Database, archive: Archive
) -> None:
    """INT-1 needs the deleted rows; giving it its own path would be a second description of
    the same permissions, which is exactly how the two drift apart."""
    with database.write_session() as session:
        session.execute(
            text("UPDATE audio SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": archive.audio},
        )
    with database.read_session() as session:
        visible = session.execute(
            audio_select(archive.reader, include_trashed=True).where(Audio.id == archive.audio)
        ).one_or_none()
        stranger_sees = session.execute(
            audio_select(archive.stranger, include_trashed=True).where(Audio.id == archive.audio)
        ).one_or_none()
    assert visible is not None
    assert stranger_sees is None, "the trash is not a way around the permissions"


# --- A disabled account ---------------------------------------------------


def test_a_disabled_account_resolves_to_nothing_despite_its_grants(
    database: Database, archive: Archive
) -> None:
    """Enforced here rather than at sign-in, so disabling somebody takes effect on their next
    request rather than on their next session."""
    assert _level(database, archive.disabled, archive.audio) is None


def test_a_disabled_owner_cannot_reach_their_own_archive(
    database: Database, archive: Archive
) -> None:
    with database.write_session() as session:
        session.execute(
            text("UPDATE user SET disabled_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": archive.owner},
        )
    assert _level(database, archive.owner, archive.audio) is None


def test_an_account_that_does_not_exist_resolves_to_nothing(
    database: Database, archive: Archive
) -> None:
    assert _level(database, 999_999, archive.audio) is None


# --- Refusals are graded (DEC-14) -----------------------------------------


def test_something_you_cannot_read_does_not_exist(database: Database, archive: Archive) -> None:
    """A 403 here would confirm the recording exists, which is what the ACL withholds."""
    with database.read_session() as session, pytest.raises(NotFoundError):
        require_audio(session, archive.stranger, _uuid_of_audio(database, archive.audio))


def test_a_missing_recording_and_somebody_elses_are_indistinguishable(
    database: Database, archive: Archive
) -> None:
    with database.read_session() as session:
        with pytest.raises(NotFoundError) as absent:
            require_audio(session, archive.stranger, "00000000-0000-4000-8000-000000000000")
        with pytest.raises(NotFoundError) as hidden:
            require_audio(session, archive.stranger, _uuid_of_audio(database, archive.audio))
    assert str(absent.value) == str(hidden.value)


def test_something_you_can_read_but_not_change_says_so(
    database: Database, archive: Archive
) -> None:
    """Pretending a recording the user is looking at does not exist would just be a lie."""
    with database.read_session() as session, pytest.raises(PermissionDeniedError):
        require_audio(session, archive.reader, _uuid_of_audio(database, archive.audio), Level.EDIT)


def test_an_editor_cannot_share(database: Database, archive: Archive) -> None:
    with database.read_session() as session, pytest.raises(PermissionDeniedError):
        require_audio(
            session, archive.editor, _uuid_of_audio(database, archive.audio), Level.MANAGE
        )


def test_a_manager_can_share(database: Database, archive: Archive) -> None:
    with database.read_session() as session:
        _, level = require_audio(
            session, archive.manager, _uuid_of_audio(database, archive.audio), Level.MANAGE
        )
    assert level is Level.MANAGE


# --- Libraries ------------------------------------------------------------


def test_a_library_grant_is_visible_on_the_library_itself(
    database: Database, archive: Archive
) -> None:
    with database.read_session() as session:
        _, level = require_library(
            session, archive.reader, _uuid_of_library(database, archive.library)
        )
    assert level is Level.READ


def test_a_recording_grant_does_not_expose_the_library_it_sits_in(
    database: Database, archive: Archive, share: Grant
) -> None:
    """The grant is on one recording. The library it happens to be in stays invisible."""
    share(
        granter=archive.owner,
        grantee=archive.stranger,
        level=Level.READ,
        audio_id=archive.private_audio,
    )
    with database.read_session() as session:
        assert (
            audio_level(session, archive.stranger, _uuid_of_audio(database, archive.private_audio))
            is Level.READ
        )
        with pytest.raises(NotFoundError):
            require_library(
                session, archive.stranger, _uuid_of_library(database, archive.private_library)
            )


def test_a_stranger_sees_no_libraries_at_all(database: Database, archive: Archive) -> None:
    with database.read_session() as session:
        assert session.execute(library_select(archive.stranger)).all() == []


# --- Composition ----------------------------------------------------------


def test_listing_returns_only_what_the_caller_holds_the_level_for(
    database: Database, archive: Archive
) -> None:
    with database.read_session() as session:
        readable = session.execute(audio_select(archive.reader)).all()
        editable = session.execute(audio_select(archive.reader, Level.EDIT)).all()
    assert [row[0].id for row in readable] == [archive.audio]
    assert editable == []


def test_the_owner_sees_every_library_they_own(database: Database, archive: Archive) -> None:
    with database.read_session() as session:
        owned = session.execute(library_select(archive.owner)).all()
    assert {row[0].id for row in owned} == {archive.library, archive.private_library}


def test_a_grant_made_after_the_recording_was_added_still_covers_it(
    database: Database, archive: Archive, share: Grant
) -> None:
    """Resolved at query time through a LEFT JOIN, so there is no denormalised copy to refresh."""
    with database.write_session() as session:
        later = insert_audio(session.connection(), archive.library, archive.owner, title="Later")
    assert _level(database, archive.reader, later) is Level.READ


def test_a_recording_added_to_a_library_shared_afterwards_is_covered_too(
    database: Database, archive: Archive, share: Grant
) -> None:
    with database.write_session() as session:
        connection = session.connection()
        newcomer = insert_user(connection, email="newcomer@example.test")
        fresh_library = insert_library(connection, archive.owner, name="Fresh")
        fresh_audio = insert_audio(connection, fresh_library, archive.owner, title="Fresh")
    share(granter=archive.owner, grantee=newcomer, level=Level.EDIT, library_id=fresh_library)
    assert _level(database, newcomer, fresh_audio) is Level.EDIT


def test_the_id_list_matches_what_the_query_returns(database: Database, archive: Archive) -> None:
    with database.read_session() as session:
        ids = set(readable_audio_ids(session, archive.reader))
        rows = {row[0].id for row in session.execute(audio_select(archive.reader)).all()}
    assert ids == rows
