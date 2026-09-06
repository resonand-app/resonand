"""Recordings: their metadata, the trash, and moving one between libraries.

Everything here goes through :mod:`sonarium.acl.query`; nothing queries ``audio`` directly.

The one function worth reading before using is :func:`move_audio`. It is the only operation in
the application with invisible consequences, and all three of them are real: it **changes who can
see the recording**, it **clears the category** (categories belong to a library), and it
**preserves the grants made on the recording itself**, because those point at the recording and
not at where it happens to live. The interface has to say all three before confirming (``UI-19``);
this module is where they are true.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from sonarium.acl.query import audio_acl, audio_select, require_audio, require_library
from sonarium.core.errors import InvalidRequestError
from sonarium.core.ids import new_uuid
from sonarium.core.levels import Level
from sonarium.core.text import clean_title
from sonarium.core.time import is_wall_clock, now_instant
from sonarium.db import search_index
from sonarium.db.models import Audio, Library
from sonarium.db.search import Filters, SortDirection, SortField, apply_filters
from sonarium.db.tags import set_audio_tags


def library_audio(
    session: Session,
    user_id: int,
    library_uuid: str,
    *,
    filters: Filters | None = None,
    sort: SortField = SortField.RECORDED_AT,
    direction: SortDirection = SortDirection.DESCENDING,
) -> Select[tuple[Audio, int]]:
    """Everything readable in one library, filtered and sorted (``API-10``).

    Returns the query so the caller pages it. The default is the most recently recorded first,
    falling back to upload date, which is what makes an imported archive of old voice notes come
    out in the order it was recorded rather than the order it happened to be copied in.

    Filtering goes through :func:`sonarium.db.search.apply_filters`, the same function search
    uses, so a filter cannot mean one thing on the grid and another in the results.
    """
    library, _ = require_library(session, user_id, library_uuid, Level.READ)
    query = audio_select(user_id).where(Audio.library_id == library.id)
    if filters is not None:
        query = apply_filters(query, filters)
    return query.order_by(*_ordering(sort, direction))


def _ordering(sort: SortField, direction: SortDirection) -> tuple[ColumnElement[Any], ...]:
    """The ``ORDER BY``, always ending in something unique.

    ``Audio.id`` is appended whatever the sort, because without it two recordings of the same
    duration -- or with the same title, or uploaded in the same second -- have no defined order
    between them, and SQLite is free to return them differently on each page. That shows up as a
    row appearing twice while somebody scrolls, which is unreproducible and looks like data loss.
    """
    column = {
        SortField.RECORDED_AT: Audio.recorded_at,
        SortField.CREATED_AT: Audio.created_at,
        SortField.DURATION_MS: Audio.duration_ms,
        SortField.TITLE: Audio.title,
    }[sort]
    if direction is SortDirection.DESCENDING:
        # Nulls last in both directions: a recording whose date is unknown is not the oldest
        # thing in the archive, it is a recording whose date is unknown.
        return (column.desc().nullslast(), Audio.created_at.desc(), Audio.id.desc())
    return (column.asc().nullslast(), Audio.created_at.asc(), Audio.id.asc())


@dataclass(frozen=True, slots=True)
class MetadataPatch:
    """What a person may change about a recording.

    Every field defaults to "leave this alone", which is what lets one endpoint serve both a
    full form submission and an inline edit of a single field. Clearing the category needs its
    own flag, because ``None`` already means "not given".
    """

    title: str | None = None
    notes: str | None = None
    recorded_at: str | None = None
    recorded_at_offset: int | None = None
    category_id: int | None = None
    clear_category: bool = False
    tags: list[str] | None = None


def update_metadata(
    session: Session, user_id: int, audio_uuid: str, patch: MetadataPatch
) -> tuple[Audio, Level]:
    """Change what a person can change about a recording (``API-9``).

    ``recorded_at`` is a wall-clock reading and is stored as written (``DEC-11``). Passing an
    instant here would be silently wrong in a way nobody notices until a recording made at half
    six shows as half five to somebody abroad, so it is refused instead.

    The caller's level comes back with the recording, because resolving it is what this function
    did first and the endpoint needs it to present the answer (``REV-7``). Nothing a patch can
    change touches it.
    """
    audio, level = require_audio(session, user_id, audio_uuid, Level.EDIT)
    if patch.title is not None:
        cleaned = patch.title.strip()
        if not cleaned:
            raise InvalidRequestError("A recording needs a title.")
        audio.title = cleaned
    if patch.notes is not None:
        audio.notes = patch.notes or None
    if patch.recorded_at is not None:
        if not is_wall_clock(patch.recorded_at):
            raise InvalidRequestError(
                "A recording date is a local reading like 2024-03-11T18:22:00, without a "
                "timezone. It is shown exactly as given and never converted."
            )
        audio.recorded_at = patch.recorded_at
        audio.recorded_at_offset = patch.recorded_at_offset
    if patch.clear_category:
        audio.category_id = None
    elif patch.category_id is not None:
        _require_category_in_library(session, audio, patch.category_id)
        audio.category_id = patch.category_id
    if patch.tags is not None:
        set_audio_tags(session, audio.id, patch.tags)
    session.flush()
    search_index.index_audio(session, audio.id)
    return audio, level


def move_audio(
    session: Session, user_id: int, audio_uuid: str, library_uuid: str
) -> tuple[Audio, Level]:
    """Move a recording into another library, in one transaction.

    The individual grants are preserved deliberately. It has no visible effect in v0, where
    recordings are only shared through their library -- and it is implemented anyway, because a
    move that quietly dropped them would be a data-loss bug that only shows up once the feature
    that creates them exists, by which time the grants are already gone.

    The level is resolved **again, afterwards**, and that is the one place where a second
    resolution is not the waste ``REV-7`` removed: a recording's permissions come from the library
    it is in, so an owner who moves one into a library they merely edit may edit it and no more.
    Returning the level from before the move would report a permission the caller no longer has.
    """
    audio, level = require_audio(session, user_id, audio_uuid, Level.EDIT)
    destination, _ = require_library(session, user_id, library_uuid, Level.EDIT)
    if destination.id == audio.library_id:
        return audio, level
    audio.library_id = destination.id
    audio.category_id = None
    session.flush()
    search_index.index_audio(session, audio.id)
    return require_audio(session, user_id, audio_uuid)


def trash_audio(session: Session, user_id: int, audio_uuid: str) -> Audio:
    """Send a recording to the trash. Never a hard delete: that is ``INT-2``, after retention."""
    audio, _ = require_audio(session, user_id, audio_uuid, Level.EDIT)
    audio.deleted_at = now_instant()
    session.flush()
    search_index.remove_audio(session, audio.id)
    return audio


def restore_audio(session: Session, user_id: int, audio_uuid: str) -> tuple[Audio, Level]:
    """Take a recording back out of the trash and put it back in the search index.

    Being in the trash is not a permission, so the level resolved on the way in is the level that
    comes back out (``REV-7``).
    """
    audio, level = require_audio(session, user_id, audio_uuid, Level.EDIT, include_trashed=True)
    audio.deleted_at = None
    session.flush()
    search_index.index_audio(session, audio.id)
    return audio, level


def trashed_audio(user_id: int) -> Select[tuple[Audio, int]]:
    """What is in this user's trash, oldest deletion first -- so what is about to go is at the
    top (``INT-1``)."""
    acl = audio_acl(user_id, include_trashed=True)
    return (
        select(Audio, acl.c.level)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(acl.c.level >= int(Level.EDIT), Audio.deleted_at.is_not(None))
        .order_by(Audio.deleted_at)
    )


def find_duplicates(session: Session, user_id: int, sha256: str) -> list[tuple[Audio, bool]]:
    """Recordings with byte-identical content, **including trashed ones** (``DEC-16``).

    Excluding the trash would let a restore produce a real duplicate, so a match there is reported
    with the flag that lets the interface offer to restore instead of uploading again. It only
    catches byte-identical files: a re-encoded copy of the same recording hashes differently, and
    the interface must not imply otherwise.
    """
    acl = audio_acl(user_id, include_trashed=True)
    rows = session.execute(
        select(Audio)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(acl.c.level >= int(Level.READ), Audio.sha256 == sha256)
    ).all()
    return [(row[0], row[0].deleted_at is not None) for row in rows]


def create_audio(  # noqa: PLR0913 -- columns of one row, and every one of them named
    session: Session,
    *,
    library_id: int,
    uploaded_by: int,
    storage_path: str,
    original_filename: str,
    uuid: str | None = None,
    title: str | None = None,
    sha256: str | None = None,
    size_bytes: int | None = None,
) -> Audio:
    """Record an ingested file. The bytes are already on disk; this is the row for them.

    The title defaults to the filename without its extension, lightly cleaned (``DEC-16``), and
    stays editable. Guessing harder only produces titles the user has to undo.

    ``uuid`` is accepted rather than always minted by the row because the upload writes the file
    before the row exists and has to know what to call the directory (``REV-1``). Left out, the
    row mints its own, which is what every other caller wants.
    """
    audio = Audio(
        uuid=uuid or new_uuid(),
        library_id=library_id,
        uploaded_by=uploaded_by,
        title=(title or clean_title(original_filename)),
        storage_path=storage_path,
        original_filename=original_filename,
        sha256=sha256,
        size_bytes=size_bytes,
        created_at=now_instant(),
    )
    session.add(audio)
    session.flush()
    search_index.index_audio(session, audio.id)
    return audio


def _require_category_in_library(session: Session, audio: Audio, category_id: int) -> None:
    """The composite foreign key would refuse this anyway; the message is the point."""
    from sonarium.db.models import Category  # noqa: PLC0415 -- kept local to avoid a cycle

    category = session.get(Category, category_id)
    if category is None or category.library_id != audio.library_id:
        library = session.get(Library, audio.library_id)
        name = library.name if library is not None else "this library"
        raise InvalidRequestError(f"That category is not in {name}.")
