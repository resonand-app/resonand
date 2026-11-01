"""Destroying much of the trash at once, and saying first what that would destroy (``API-28``).

**One description of what a caller's trash holds, read three ways.** The trashed libraries they
manage, with everything inside each, and the trashed recordings they manage: the summary counts
it, a purge narrows it to a selection, and an empty bounds it by the instant the summary was
counted at. Because all three are the same set, the numbers a confirmation states and what the
purge then destroys cannot drift apart -- which they would the day one of three hand-written
queries learnt something the other two did not.

A library takes everything in it, trashed separately or not, for the reason
:func:`resonand.db.libraries.purge_library` gives; and a recording reached both on its own and
through its library is one recording, counted and destroyed once.

**Nothing here tells a refusal apart.** A uuid that is not in the trash, is not the caller's to
manage, or is gone already comes back in one list of what was skipped. Telling them apart would
confirm a recording exists to somebody who may not read it, which is what a 404 is never allowed
to do here.
"""

from __future__ import annotations

from collections.abc import Collection
from dataclasses import dataclass

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from resonand.db.audio import remove_recording, trashed_audio
from resonand.db.libraries import trashed_libraries
from resonand.db.models import Audio, Library, Transcript


@dataclass(frozen=True)
class Tally:
    """What a part of the trash amounts to, in the numbers a confirmation states."""

    recordings: int
    libraries: int
    duration_ms: int
    transcripts: int
    """Recordings that have one, rather than versions: a corrected transcript is still the one
    transcript to whoever reads the confirmation, and destroying the recording takes every
    version with it."""


@dataclass(frozen=True)
class Purged:
    """What a purge destroyed, the files its caller now removes, and what it left alone."""

    tally: Tally
    audio_uuids: list[str]
    skipped: list[str]


@dataclass(frozen=True)
class _Scope:
    library_uuids: Collection[str] | None = None
    audio_uuids: Collection[str] | None = None
    trashed_before: str | None = None


def summarise(session: Session, user_id: int, counted_at: str) -> Tally:
    """The whole of this user's trash as it stands at ``counted_at``.

    Bounded by the same instant an empty is later given, so that what was sent to the trash in the
    moment between counting and reading is left out of both rather than of one.
    """
    scope = _Scope(trashed_before=counted_at)
    libraries = _libraries(session, user_id, scope)
    return _tally(session, _audio_ids(user_id, scope, libraries), len(libraries))


def purge_selection(
    session: Session,
    user_id: int,
    *,
    library_uuids: Collection[str],
    audio_uuids: Collection[str],
) -> Purged:
    """Destroy what was selected, and say which of the uuids given were not destroyed.

    A recording selected alongside the library it sits in is destroyed with the library and is
    not skipped: it went, which is what was asked.
    """
    scope = _Scope(library_uuids=list(library_uuids), audio_uuids=list(audio_uuids))
    libraries = _libraries(session, user_id, scope)
    purged_libraries = {library.uuid for library in libraries}
    purged = _destroy(session, user_id, scope, libraries)
    destroyed = set(purged.audio_uuids)
    skipped = [uuid for uuid in dict.fromkeys(library_uuids) if uuid not in purged_libraries]
    skipped += [uuid for uuid in dict.fromkeys(audio_uuids) if uuid not in destroyed]
    return Purged(purged.tally, purged.audio_uuids, skipped)


def empty(session: Session, user_id: int, trashed_before: str) -> Purged:
    """Destroy everything this user's trash held at ``trashed_before``, and nothing sent after."""
    scope = _Scope(trashed_before=trashed_before)
    return _destroy(session, user_id, scope, _libraries(session, user_id, scope))


def _destroy(session: Session, user_id: int, scope: _Scope, libraries: list[Library]) -> Purged:
    """The rows, in the caller's one write session. The files are the caller's, after commit."""
    audio_ids = _audio_ids(user_id, scope, libraries)
    tally = _tally(session, audio_ids, len(libraries))
    doomed = session.execute(select(Audio).where(Audio.id.in_(audio_ids))).scalars().all()
    uuids = [remove_recording(session, audio) for audio in doomed]
    for library in libraries:
        session.delete(library)
    session.flush()
    return Purged(tally, uuids, [])


def _libraries(session: Session, user_id: int, scope: _Scope) -> list[Library]:
    query = trashed_libraries(user_id)
    if scope.library_uuids is not None:
        query = query.where(Library.uuid.in_(scope.library_uuids))
    if scope.trashed_before is not None:
        query = query.where(Library.deleted_at <= scope.trashed_before)
    return [row[0] for row in session.execute(query)]


def _audio_ids(user_id: int, scope: _Scope, libraries: list[Library]) -> Select[tuple[int]]:
    """Every recording in ``libraries``, and every trashed one in scope on its own, once each."""
    loose = trashed_audio(user_id).order_by(None)
    if scope.audio_uuids is not None:
        loose = loose.where(Audio.uuid.in_(scope.audio_uuids))
    if scope.trashed_before is not None:
        loose = loose.where(Audio.deleted_at <= scope.trashed_before)
    return select(Audio.id).where(
        or_(
            Audio.library_id.in_([library.id for library in libraries]),
            Audio.id.in_(select(loose.subquery().c.id)),
        )
    )


def _tally(session: Session, audio_ids: Select[tuple[int]], libraries: int) -> Tally:
    recordings, duration_ms = session.execute(
        select(func.count(Audio.id), func.coalesce(func.sum(Audio.duration_ms), 0)).where(
            Audio.id.in_(audio_ids)
        )
    ).one()
    transcripts = session.execute(
        select(func.count(func.distinct(Transcript.audio_id))).where(
            Transcript.audio_id.in_(audio_ids)
        )
    ).scalar_one()
    return Tally(
        recordings=recordings,
        libraries=libraries,
        duration_ms=duration_ms,
        transcripts=transcripts,
    )
