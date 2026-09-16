"""Turning rows into the shapes the API publishes.

Kept apart from the routes because two of these are load-bearing rather than mechanical:

* **The four transcription states** the card has to distinguish (``UI-6``) are not a column. They
  are derived from what transcripts and jobs exist for a recording, and deriving them in two
  places is how a card and a detail view end up disagreeing about whether something failed.
* **A recording's own time** leaves as it was written. Nothing here ever merges ``recorded_at``
  and ``recorded_at_offset`` into an instant.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from sonarium.api.schemas import (
    AdminUser,
    AudioDetail,
    AudioSummary,
    CategorySummary,
    JobSummary,
    LibrarySummary,
    SegmentOut,
    ShareSummary,
    TagSummary,
    TranscriptDetail,
    TranscriptionStatus,
    TranscriptSummary,
    UserSummary,
)
from sonarium.core.colours import Colour
from sonarium.core.levels import DESCRIPTIONS, Level
from sonarium.core.states import TranscriptionState
from sonarium.db import libraries as library_repo
from sonarium.db import tags as tag_repo
from sonarium.db.models import (
    Audio,
    Category,
    Job,
    Library,
    Segment,
    Share,
    Tag,
    Transcript,
    User,
)
from sonarium.jobs import queue


def transcription_state(session: DbSession, audio_id: int) -> TranscriptionState:
    """Which of the four states a recording is in.

    A finished transcript wins over a failed job: re-transcribing after a failure leaves the
    failure in the job table, and a recording that has a transcript is not in a failed state
    whatever happened on the way there.

    The same question is answered in SQL by :func:`sonarium.db.search.apply_filters`, and the two
    have to agree -- see :mod:`sonarium.core.states`.
    """
    has_transcript = (
        session.execute(
            select(Transcript.id).where(Transcript.audio_id == audio_id, Transcript.is_active == 1)
        ).first()
        is not None
    )
    if has_transcript:
        return TranscriptionState.DONE
    states = set(
        session.execute(
            select(Job.state).where(Job.audio_id == audio_id, Job.kind == queue.KIND_TRANSCRIBE)
        )
        .scalars()
        .all()
    )
    if states & {queue.PENDING, queue.RUNNING}:
        return TranscriptionState.RUNNING
    if queue.FAILED in states:
        return TranscriptionState.FAILED
    return TranscriptionState.NONE


def transcription_status(session: DbSession, audio_id: int) -> TranscriptionStatus:
    """What there is to say about a recording's transcription (``API-17``, ``UI-15``).

    The state comes from the same function the badge uses, and the three facts that only exist on
    the job come from the newest transcribe job. A recording that has never been asked about has
    no job, and that is not a gap: state ``none`` with no attempts is exactly what the call to
    action is drawn against.
    """
    job = queue.latest_transcription(session, audio_id)
    if job is None:
        return TranscriptionStatus(
            state=transcription_state(session, audio_id),
            attempts=0,
            started_at=None,
            error=None,
        )
    return TranscriptionStatus(
        state=transcription_state(session, audio_id),
        attempts=job.attempts,
        # A job back in ``pending`` after a failure has a ``started_at`` from the attempt that
        # failed, and reporting it would count elapsed time from a run that already ended.
        started_at=job.started_at if job.state == queue.RUNNING else None,
        error=job.error,
    )


def user_summary(user: User) -> UserSummary:
    return UserSummary(id=user.id, display_name=user.display_name, email=user.email)


def admin_user(user: User) -> AdminUser:
    """The same account, for the one caller allowed to know how it stands (``API-20``).

    Two facts more than :func:`user_summary`, and both of them are why administration exists:
    ``INT-3b`` chooses between disable and re-enable, which it cannot do without knowing which
    one the account is already in, and it marks the people who run the instance.
    """
    return AdminUser(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        is_admin=bool(user.is_admin),
        disabled_at=user.disabled_at,
        created_at=user.created_at,
    )


def tag_summary(tag: Tag) -> TagSummary:
    return TagSummary.model_validate(tag)


def library_summary(session: DbSession, library: Library, level: Level) -> LibrarySummary:
    owner = session.get(User, library.owner_id)
    count, duration = library_repo.library_totals(session, library.id)
    return LibrarySummary(
        uuid=library.uuid,
        name=library.name,
        description=library.description,
        is_personal=bool(library.is_personal),
        owner=user_summary(owner) if owner is not None else _unknown_user(library.owner_id),
        level=level,
        colour=Colour(library.colour),
        audio_count=count,
        total_duration_ms=duration,
        deleted_at=library.deleted_at,
    )


def share_summary(share: Share, grantee: User) -> ShareSummary:
    level = Level(share.level)
    return ShareSummary(
        grantee=user_summary(grantee),
        level=level,
        level_description=DESCRIPTIONS[level],
        granted_by=share.granted_by,
        created_at=share.created_at,
        source="library" if share.library_id is not None else "audio",
    )


def category_summary(category: Category) -> CategorySummary:
    return CategorySummary.model_validate(category)


def audio_summary(
    session: DbSession,
    audio: Audio,
    level: Level,
    *,
    tags: Sequence[Tag] | None = None,
    shared: bool | None = None,
) -> AudioSummary:
    """A recording as the grid and the list draw it.

    ``tags`` and ``shared`` can be passed in when the caller has already fetched them for a whole
    page, which is the difference between one query and eighty.
    """
    library = session.get(Library, audio.library_id)
    resolved = tags if tags is not None else tag_repo.tags_for_audio(session, audio.id)
    return AudioSummary(
        uuid=audio.uuid,
        title=audio.title,
        notes=audio.notes,
        recorded_at=audio.recorded_at,
        recorded_at_offset=audio.recorded_at_offset,
        recorded_at_source=audio.recorded_at_source,
        created_at=audio.created_at,
        duration_ms=audio.duration_ms,
        library_uuid=library.uuid if library is not None else "",
        category_id=audio.category_id,
        tags=[tag_summary(tag) for tag in resolved],
        level=level,
        transcription_state=transcription_state(session, audio.id),
        has_waveform=audio.waveform is not None,
        is_shared_individually=(
            shared if shared is not None else bool(_individually_shared(session, [audio.id]))
        ),
        deleted_at=audio.deleted_at,
    )


def audio_detail(session: DbSession, audio: Audio, level: Level) -> AudioDetail:
    """Everything the detail view shows, including the technical metadata it keeps collapsed."""
    uploader = session.get(User, audio.uploaded_by)
    return AudioDetail.model_validate(
        audio_summary(session, audio, level).model_dump()
        | {
            "original_filename": audio.original_filename,
            "mime": audio.mime,
            "size_bytes": audio.size_bytes,
            "sha256": audio.sha256,
            "sample_rate": audio.sample_rate,
            "channels": audio.channels,
            "codec": audio.codec,
            "uploaded_by": (
                user_summary(uploader) if uploader is not None else _unknown_user(audio.uploaded_by)
            ),
        }
    )


def audio_summaries(session: DbSession, rows: Sequence[tuple[Audio, int]]) -> list[AudioSummary]:
    """Many recordings at once, with their tags fetched in one query rather than one per card."""
    audio_ids = [row[0].id for row in rows]
    tags_by_audio = tag_repo.tags_for_audios(session, audio_ids)
    shared_ids = _individually_shared(session, audio_ids)
    return [
        audio_summary(
            session,
            audio,
            Level(level),
            tags=tags_by_audio.get(audio.id, []),
            shared=audio.id in shared_ids,
        )
        for audio, level in rows
    ]


def transcript_summary(session: DbSession, transcript: Transcript) -> TranscriptSummary:
    count = len(
        session.execute(select(Segment.id).where(Segment.transcript_id == transcript.id))
        .scalars()
        .all()
    )
    return TranscriptSummary(
        id=transcript.id,
        is_active=bool(transcript.is_active),
        source=transcript.source,
        provider=transcript.provider,
        model=transcript.model,
        language=transcript.language,
        created_at=transcript.created_at,
        segment_count=count,
    )


def transcript_detail(
    session: DbSession, transcript: Transcript, segments: Sequence[Segment]
) -> TranscriptDetail:
    summary = transcript_summary(session, transcript)
    return TranscriptDetail(
        **summary.model_dump(),
        segments=[SegmentOut.model_validate(segment) for segment in segments],
    )


def job_summary(job: Job, audio_uuid: str | None) -> JobSummary:
    """One piece of background work, wherever it is reported.

    Shared by the administration queue and by ``API-11``'s 202, so a caller who asked for a
    transcription and an operator watching the queue are looking at the same description of the
    same thing.
    """
    return JobSummary(
        id=job.id,
        kind=job.kind,
        state=job.state,
        attempts=job.attempts,
        audio_uuid=audio_uuid,
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
        ready_at=queue.ready_at(job) if job.state == queue.PENDING else None,
    )


def _individually_shared(session: DbSession, audio_ids: Sequence[int]) -> set[int]:
    """Which of these carry a grant of their own, for the discreet badge on the card."""
    if not audio_ids:
        return set()
    found = (
        session.execute(select(Share.audio_id).where(Share.audio_id.in_(audio_ids))).scalars().all()
    )
    return {audio_id for audio_id in found if audio_id is not None}


def _unknown_user(user_id: int) -> UserSummary:
    """A user row that has gone. Deleting a user with content is refused in v0, so this is a
    defence against a database edited by hand rather than a case the application produces."""
    return UserSummary(id=user_id, display_name="Unknown", email="")
