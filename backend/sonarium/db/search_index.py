"""The write path for the search indexes (``JOB-9``).

``segment_fts`` needs nothing from this module: it is an external-content table over one column
of ``segment`` and triggers in the first migration keep it in step. It appears here only so that
``sonarium reindex`` has one place to call.

``audio_fts`` is the one that needs code. Its projection -- title, notes and the recording's tag
names -- spans three tables, and a trigger set over ``audio``, ``audio_tag`` and ``tag``, each
with insert, update and delete, would be nine triggers that nobody can review and that would
*still* miss a tag renamed under a recording nobody touched. So the rule is: **every change to a
recording's title, notes or tags calls :func:`index_audio` in the same transaction.** One module
writes this table, and that is the whole reason it is reviewable.

Trashed recordings are not indexed. The ACL entry point (``DAT-3``) hides them anyway, so an
indexed row would be work spent to produce results that are then filtered out; :func:`index_audio`
therefore *removes* a recording that has been trashed, and restoring one has to index it again.

Nothing here commits. Every function expects the session of an open
:func:`sonarium.db.engine.write_session`, so that a metadata change and its index update land
together or not at all.
"""

from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

_TAG_NAMES = """
    (SELECT group_concat(tag.name, ' ')
       FROM audio_tag JOIN tag ON tag.id = audio_tag.tag_id
      WHERE audio_tag.audio_id = audio.id)
"""
"""The tag third of the projection. ``group_concat`` leaves the order unspecified, which costs
nothing: FTS5 indexes the words, not the string."""

_DELETE_ONE = text("DELETE FROM audio_fts WHERE rowid = :audio_id")

_INSERT_ONE = text(
    f"""
    INSERT INTO audio_fts(rowid, title, notes, tags)
    SELECT audio.id, audio.title, COALESCE(audio.notes, ''), COALESCE({_TAG_NAMES}, '')
      FROM audio
     WHERE audio.id = :audio_id AND audio.deleted_at IS NULL
    """  # noqa: S608 -- the interpolated fragment is the module constant above, not input
)

_INSERT_ALL = text(
    f"""
    INSERT INTO audio_fts(rowid, title, notes, tags)
    SELECT audio.id, audio.title, COALESCE(audio.notes, ''), COALESCE({_TAG_NAMES}, '')
      FROM audio
     WHERE audio.deleted_at IS NULL
    """  # noqa: S608 -- as above
)

_DELETE_ALL = text("DELETE FROM audio_fts")

_COUNT_ALL = text("SELECT count(*) FROM audio_fts")

_REBUILD_SEGMENTS = text("INSERT INTO segment_fts(segment_fts) VALUES ('rebuild')")


def index_audio(session: Session, audio_id: int) -> None:
    """Bring one recording's row in ``audio_fts`` up to date.

    Delete-then-insert rather than an update, because the row may not exist yet and because a
    recording that has since been trashed has to end up absent, not stale.
    """
    session.execute(_DELETE_ONE, {"audio_id": audio_id})
    session.execute(_INSERT_ONE, {"audio_id": audio_id})


def remove_audio(session: Session, audio_id: int) -> None:
    """Drop one recording from ``audio_fts``. Called when it is trashed or purged."""
    session.execute(_DELETE_ONE, {"audio_id": audio_id})


def rebuild_audio_index(session: Session) -> int:
    """Rebuild ``audio_fts`` from scratch and report how many recordings it now covers.

    The count is read back off the index rather than off ``audio``, so the number reported by
    ``sonarium reindex`` is what got indexed and not what should have been.
    """
    session.execute(_DELETE_ALL)
    session.execute(_INSERT_ALL)
    return int(session.execute(_COUNT_ALL).scalar_one())


def rebuild_segment_index(session: Session) -> None:
    """Rebuild ``segment_fts`` from its content table, using FTS5's own command."""
    session.execute(_REBUILD_SEGMENTS)


def rebuild_all(session: Session) -> int:
    """Rebuild both indexes -- what ``sonarium reindex`` calls. Returns the recordings covered."""
    rebuild_segment_index(session)
    return rebuild_audio_index(session)
