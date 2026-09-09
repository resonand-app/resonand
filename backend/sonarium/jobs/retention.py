"""The retention purge (``INT-2``).

Deletion in Sonarium is always a trash with retention (principle 5), which means something has to
eventually empty it -- and that something is the only place in the whole application that removes
a file from ``storage/``. Everything else that deletes sets ``deleted_at`` and touches no bytes,
which is why a restore is instant.

**Scheduling is the idempotency key.** There is no cron and no scheduler thread: the worker
enqueues a purge whose key contains today's date, so the second attempt of the day is refused by
the queue rather than by a timer. That survives restarts, cannot double-run, and needs no state
of its own -- and if an instance is switched off for a week it purges once when it comes back,
not seven times.

Order matters here and it is the opposite of the intuitive one: the row goes first, inside a
transaction, and the files go after. A crash between the two leaves files that no row points at,
which ``sonarium fsck`` reports as orphans and an operator can delete. A crash the other way round
would leave rows pointing at files that are gone, which reads as data loss.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from sonarium.core.time import instant_after, now_instant, utc_now
from sonarium.db import search_index, sessions
from sonarium.db.models import Audio, Library
from sonarium.jobs.queue import Work, enqueue

KIND_PURGE = "purge"


@dataclass(frozen=True, slots=True)
class Purged:
    """What one purge removed."""

    recordings: int
    libraries: int
    files: int
    sessions: int

    @property
    def is_empty(self) -> bool:
        return not (self.recordings or self.libraries or self.files or self.sessions)


def daily_key(prefix: str = KIND_PURGE) -> str:
    """One key per day, which is the whole scheduler."""
    return f"{prefix}:{now_instant()[:10]}"


def schedule(session: Session) -> bool:
    """Queue today's purge, or recognise that it is already queued. Returns whether it was new."""
    return enqueue(session, KIND_PURGE, idempotency_key=daily_key()) is not None


def due_before(retention_days: int) -> str:
    """The instant a recording must have been deleted before to be purged now."""
    return instant_after(timedelta(days=-retention_days), since=utc_now())


def expired_recordings(session: Session, retention_days: int) -> list[Audio]:
    """Recordings whose retention period has run out.

    **A trashed library expires everything inside it, trashed separately or not.** Trashing a
    library sets one ``deleted_at`` and touches no recording rows, which is what makes restoring
    it one line -- so matching on the recording's own ``deleted_at`` alone found nothing in it,
    ``expired_libraries`` then found the library still holding rows, and a trashed library was
    kept for ever while ``INT-1`` counted down to a purge that could not arrive.

    Either instant expiring is enough. A recording trashed before its library reaches the end of
    its own retention first, and a library trashed before its recordings takes them with it: the
    library going was the decision about everything in it.
    """
    cutoff = due_before(retention_days)
    return list(
        session.execute(
            select(Audio)
            .join(Library, Library.id == Audio.library_id)
            .where(
                or_(
                    and_(Audio.deleted_at.is_not(None), Audio.deleted_at < cutoff),
                    and_(Library.deleted_at.is_not(None), Library.deleted_at < cutoff),
                )
            )
        )
        .scalars()
        .all()
    )


def expired_libraries(session: Session, retention_days: int) -> list[Library]:
    """Libraries whose retention period has run out and which now hold nothing."""
    cutoff = due_before(retention_days)
    candidates = list(
        session.execute(
            select(Library).where(Library.deleted_at.is_not(None), Library.deleted_at < cutoff)
        )
        .scalars()
        .all()
    )
    return [
        library
        for library in candidates
        if session.execute(select(Audio.id).where(Audio.library_id == library.id)).first() is None
    ]


def remove_recording(session: Session, audio: Audio) -> str:
    """Delete one recording's row, returning the uuid whose files now have to go.

    The caller deletes the files afterwards and outside this transaction. See the module note on
    why that order is the safe one.
    """
    audio_uuid = audio.uuid
    search_index.remove_audio(session, audio.id)
    session.execute(delete(Audio).where(Audio.id == audio.id))
    return audio_uuid


def purge_sessions(session: Session) -> int:
    """Mark sessions whose expiry has passed, so the profile view stops offering to revoke them."""
    return sessions.purge_expired(session)


def is_purge(work: Work) -> bool:
    """Whether a claimed job is a purge."""
    return work.kind == KIND_PURGE
