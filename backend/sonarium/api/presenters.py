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
    TranscriptFeatures,
    TranscriptionStatus,
    TranscriptSummary,
    UserSummary,
)
from sonarium.core.colours import Colour
from sonarium.core.levels import DESCRIPTIONS, Level
from sonarium.core.states import TranscriptionState
from sonarium.db import libraries as library_repo
from sonarium.db import tags as tag_repo
from sonarium.db import transcripts
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


def _state_of(has_transcript: bool, job_states: set[str]) -> TranscriptionState:
    """The precedence, in one place because both callers below have to agree with it.

    A finished transcript wins over a failed job: re-transcribing after a failure leaves the
    failure in the job table, and a recording that has a transcript is not in a failed state
    whatever happened on the way there.

    The same question is answered in SQL by :func:`sonarium.db.search.apply_filters`, and the two
    have to agree -- see :mod:`sonarium.core.states`.
    """
    if has_transcript:
        return TranscriptionState.DONE
    if job_states & {queue.PENDING, queue.RUNNING}:
        return TranscriptionState.RUNNING
    if queue.FAILED in job_states:
        return TranscriptionState.FAILED
    return TranscriptionState.NONE


def transcription_states(
    session: DbSession, audio_ids: Sequence[int]
) -> dict[int, TranscriptionState]:
    """Which of the four states each of these recordings is in, in two queries (``REV-3``).

    Two whatever the page holds, following :func:`sonarium.db.tags.tags_for_audios`. Asked one
    recording at a time it was two queries per card, which is the largest part of what a fifty
    card page used to cost.
    """
    if not audio_ids:
        return {}
    wanted = set(audio_ids)
    transcribed = set(
        session.execute(
            select(Transcript.audio_id).where(
                Transcript.audio_id.in_(wanted), Transcript.is_active == 1
            )
        )
        .scalars()
        .all()
    )
    jobs: dict[int, set[str]] = {}
    for audio_id, state in session.execute(
        select(Job.audio_id, Job.state).where(
            Job.audio_id.in_(wanted), Job.kind == queue.KIND_TRANSCRIBE
        )
    ).all():
        jobs.setdefault(int(audio_id), set()).add(state)
    return {
        audio_id: _state_of(audio_id in transcribed, jobs.get(audio_id, set()))
        for audio_id in wanted
    }


def transcription_state(session: DbSession, audio_id: int) -> TranscriptionState:
    """Which of the four states one recording is in, for the paths that have only one."""
    return transcription_states(session, [audio_id])[audio_id]


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


def library_summary(
    session: DbSession,
    library: Library,
    level: Level,
    *,
    owner: User | None = None,
    totals: tuple[int, int] | None = None,
) -> LibrarySummary:
    """One library as the sidebar and its header draw it.

    ``owner`` and ``totals`` can be passed in when the caller has already fetched them for a
    whole list, on the same principle as ``tags`` on :func:`audio_summary`.
    """
    owner = owner if owner is not None else session.get(User, library.owner_id)
    count, duration = (
        totals if totals is not None else library_repo.library_totals(session, library.id)
    )
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
    library_uuid: str | None = None,
    state: TranscriptionState | None = None,
) -> AudioSummary:
    """A recording as the grid and the list draw it.

    Everything after ``level`` can be passed in when the caller has already fetched it for a
    whole page, which is the difference between one query and eighty. ``session.get(Library,
    ...)`` is the one worth naming: it is *not* served from the identity map, so fifty cards in
    one library asked for that row fifty times (``REV-3``).
    """
    resolved_library = (
        library_uuid if library_uuid is not None else _library_uuid(session, audio.library_id)
    )
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
        library_uuid=resolved_library,
        category_id=audio.category_id,
        tags=[tag_summary(tag) for tag in resolved],
        level=level,
        transcription_state=(
            state if state is not None else transcription_state(session, audio.id)
        ),
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
    """Many recordings at once, each thing a card needs fetched once for the whole page.

    Five queries for a page of any size (``REV-3``). What it replaced grew three statements per
    card on a fixed floor of six -- 21 for five cards, 81 for twenty-five, 156 for fifty -- which
    is the shape somebody meets as the grid getting slower the more they archive.
    """
    audio_ids = [row[0].id for row in rows]
    tags_by_audio = tag_repo.tags_for_audios(session, audio_ids)
    shared_ids = _individually_shared(session, audio_ids)
    states = transcription_states(session, audio_ids)
    library_uuids = _library_uuids(session, [row[0].library_id for row in rows])
    return [
        audio_summary(
            session,
            audio,
            Level(level),
            tags=tags_by_audio.get(audio.id, []),
            shared=audio.id in shared_ids,
            library_uuid=library_uuids.get(audio.library_id, ""),
            state=states.get(audio.id, TranscriptionState.NONE),
        )
        for audio, level in rows
    ]


def library_summaries(
    session: DbSession, rows: Sequence[tuple[Library, int]]
) -> list[LibrarySummary]:
    """Many libraries at once, with their owners and their totals each asked for once.

    The sidebar's list is not paginated, so this grew with the number of libraries somebody has
    rather than with a page size: an owner row and a totals query each (``REV-3``).
    """
    libraries = [library for library, _level in rows]
    owners = _users_by_id(session, [library.owner_id for library in libraries])
    totals = library_repo.totals_for_libraries(session, [library.id for library in libraries])
    return [
        library_summary(
            session,
            library,
            Level(level),
            owner=owners.get(library.owner_id),
            totals=totals.get(library.id, (0, 0)),
        )
        for library, level in rows
    ]


def transcript_summary(session: DbSession, transcript: Transcript) -> TranscriptSummary:
    features = transcripts.features_of(session, transcript)
    return TranscriptSummary(
        id=transcript.id,
        is_active=bool(transcript.is_active),
        source=transcript.source,
        provider=transcript.provider,
        model=transcript.model,
        language=transcript.language,
        created_at=transcript.created_at,
        segment_count=features.segment_count,
        features=TranscriptFeatures(
            task=features.task,
            has_speakers=features.has_speakers,
            speaker_count=features.speaker_count,
            speakers_are_comparable=features.speakers_are_comparable,
            granularity_ms=features.granularity_ms,
            stitched_from=features.stitched_from,
        ),
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


def _library_uuid(session: DbSession, library_id: int) -> str:
    """One library's public identifier, for the single-recording paths."""
    return _library_uuids(session, [library_id]).get(library_id, "")


def _library_uuids(session: DbSession, library_ids: Sequence[int]) -> dict[int, str]:
    """Public identifiers for the libraries a page's recordings are in, in one query."""
    if not library_ids:
        return {}
    rows = session.execute(
        select(Library.id, Library.uuid).where(Library.id.in_(set(library_ids)))
    ).all()
    return {int(library_id): str(uuid) for library_id, uuid in rows}


def _users_by_id(session: DbSession, user_ids: Sequence[int]) -> dict[int, User]:
    """The accounts a list needs to name, in one query rather than one each."""
    if not user_ids:
        return {}
    found = session.execute(select(User).where(User.id.in_(set(user_ids)))).scalars().all()
    return {user.id: user for user in found}


def _unknown_user(user_id: int) -> UserSummary:
    """A user row that has gone. Deleting a user with content is refused in v0, so this is a
    defence against a database edited by hand rather than a case the application produces."""
    return UserSummary(id=user_id, display_name="Unknown", email="")
