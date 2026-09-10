"""Transcripts and their segments (``JOB-6``, ``JOB-7``).

**Always segments, never a wall of text.** Plain text, subtitles and the highlighting that follows
playback are all derived from segments; nothing derives segments back out of text. That is what
makes the transcript clickable, and it is why ``speaker`` is on the row from the first migration
even though nothing writes it yet -- adding it later would mean rewriting every transcript in the
archive to give it a column it could have had for free.

**Several transcripts per recording.** Re-transcribing with a better model creates a new row
rather than overwriting the old one, and exactly one row is active. Engine independence
(principle 3) is only real if changing engine loses nothing, and overwriting is losing something.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from sonarium.core.errors import InvalidRequestError, NotFoundError
from sonarium.core.time import now_instant
from sonarium.db.models import Segment, Transcript


@dataclass(frozen=True, slots=True)
class SegmentDraft:
    """One timed piece of a transcript, before it has a row."""

    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None


@dataclass(frozen=True, slots=True)
class Origin:
    """Where a transcript came from -- which is exactly what the selector shows when a
    recording has more than one (``UI-14``)."""

    source: str = "service"
    """``service`` | ``manual`` | ``imported``."""

    provider: str | None = None
    model: str | None = None
    language: str | None = None
    derived_from: int | None = None
    """The transcript this one was edited from, which is kept."""


def create_transcript(
    session: Session,
    audio_id: int,
    segments: list[SegmentDraft],
    origin: Origin | None = None,
    *,
    make_active: bool = True,
) -> Transcript:
    """Store a transcript and its segments, optionally making it the active one.

    The timings are checked before the first row is written, so a provider that returned an end
    before its start fails the job it came from instead of leaving a transcript that reads
    correctly and seeks to the wrong place (``REV-6``).
    """
    validate_segments(segments)
    provenance = origin or Origin()
    transcript = Transcript(
        audio_id=audio_id,
        is_active=0,
        source=provenance.source,
        provider=provenance.provider,
        model=provenance.model,
        language=provenance.language,
        created_at=now_instant(),
        derived_from=provenance.derived_from,
    )
    session.add(transcript)
    session.flush()
    replace_segments(session, transcript.id, segments)
    if make_active:
        activate(session, transcript.id)
    return transcript


def replace_segments(
    session: Session, transcript_id: int, segments: list[SegmentDraft]
) -> list[Segment]:
    """Set a transcript's segments to exactly these, in order.

    The ``idx`` is assigned here rather than taken from the caller: it is the transcript's own
    ordering and a provider that returned its parts out of order should not be able to scramble
    it.
    """
    session.execute(delete(Segment).where(Segment.transcript_id == transcript_id))
    rows = [
        Segment(
            transcript_id=transcript_id,
            idx=index,
            start_ms=draft.start_ms,
            end_ms=draft.end_ms,
            speaker=draft.speaker,
            text=draft.text,
        )
        for index, draft in enumerate(segments)
    ]
    session.add_all(rows)
    session.flush()
    return rows


def activate(session: Session, transcript_id: int) -> Transcript:
    """Make one transcript the active one, atomically.

    The deactivation and the activation are one statement pair inside the caller's transaction,
    because a unique partial index enforces that at most one row is active and a gap between the
    two would either violate it or leave the recording with no transcript at all.
    """
    transcript = session.get(Transcript, transcript_id)
    if transcript is None:
        raise NotFoundError("No such transcript.")
    session.execute(
        update(Transcript)
        .where(Transcript.audio_id == transcript.audio_id, Transcript.is_active == 1)
        .values(is_active=0)
    )
    transcript.is_active = 1
    session.flush()
    return transcript


def active_transcript(session: Session, audio_id: int) -> Transcript | None:
    """The transcript currently shown for a recording, if it has one."""
    return session.execute(
        select(Transcript).where(Transcript.audio_id == audio_id, Transcript.is_active == 1)
    ).scalar_one_or_none()


def list_transcripts(session: Session, audio_id: int) -> list[Transcript]:
    """Every transcript a recording has, newest first (``UI-14``)."""
    return list(
        session.execute(
            select(Transcript)
            .where(Transcript.audio_id == audio_id)
            .order_by(Transcript.created_at.desc())
        )
        .scalars()
        .all()
    )


def segments_of(session: Session, transcript_id: int) -> list[Segment]:
    """A transcript's segments in playback order."""
    return list(
        session.execute(
            select(Segment).where(Segment.transcript_id == transcript_id).order_by(Segment.idx)
        )
        .scalars()
        .all()
    )


def plain_text(segments: list[Segment]) -> str:
    """The transcript as text, derived from the segments and never stored.

    Storing it would create a second copy that can disagree with the first, and the export
    (``ING-11``) would then have to decide which one is true.
    """
    return " ".join(segment.text.strip() for segment in segments if segment.text.strip())


def validate_segments(segments: list[SegmentDraft]) -> None:
    """Refuse a transcript whose timings could not line up with playback.

    A provider that returns an end before its start, or a negative offset, has given us something
    that will silently seek to the wrong place; failing here is how that gets noticed while the
    provider is still on screen. ``create_transcript`` calls it, so every path into the archive --
    the worker, the import and the seed -- goes through it.
    """
    for index, segment in enumerate(segments):
        if segment.start_ms < 0 or segment.end_ms < segment.start_ms:
            raise InvalidRequestError(
                f"Segment {index} is timed impossibly: {segment.start_ms}ms to {segment.end_ms}ms."
            )
