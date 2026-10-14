"""Favourites (``DAT-11``).

A mark one account puts on a recording it can read, and a place that gathers them whichever
library each sits in. **It is not a library**: a library is the unit of ownership and permission,
and a recording sits in exactly one.

**Marking needs nothing more than reading.** The mark belongs to the person making it and asks
nothing of the recording, so a library shared read-only can be marked as freely as one's own.

**What happens to a mark falls out of the ACL.** Every read of this table joins it, so trashing a
recording hides the mark and restoring it brings the mark back, a move keeps it, and a revoked grant
hides it until the same grant is given back. A row nobody but its owner can read leaks nothing, so
there is nothing to clean up -- the cascade from a purged recording or a deleted account is the only
thing that removes one its owner did not.
"""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from resonand.acl.query import require_audio
from resonand.db.models import Audio, Favourite


def mark(session: Session, user_id: int, audio_uuid: str) -> Audio:
    """Mark a recording, once however often it is asked. Unreadable or trashed is not found."""
    audio, _ = require_audio(session, user_id, audio_uuid)
    if session.get(Favourite, (user_id, audio.id)) is None:
        session.add(Favourite(user_id=user_id, audio_id=audio.id))
        session.flush()
    return audio


def unmark(session: Session, user_id: int, audio_uuid: str) -> Audio:
    """Take the mark off, which is not an error when there was none."""
    audio, _ = require_audio(session, user_id, audio_uuid)
    existing = session.get(Favourite, (user_id, audio.id))
    if existing is not None:
        session.delete(existing)
        session.flush()
    return audio


def marked_by(user_id: int) -> Select[tuple[int]]:
    """The recordings this account has marked, as ids for an ``IN``.

    Readable or not: the caller's query already joins the ACL, and filtering twice would be the
    second permission check the application layer is not allowed to have.
    """
    return select(Favourite.audio_id).where(Favourite.user_id == user_id)
