"""Recordings: metadata, the trash, moving and transcripts (``API-9``).

Nothing here checks a permission. Every function reaches the database through
:mod:`sonarium.acl.query`, which is also what makes a recording somebody may not read answer 404
rather than 403 without any endpoint having to remember to.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from sonarium.acl.query import audio_select, require_audio
from sonarium.api.deps import (
    ArchiveDatabase,
    CurrentCaller,
    InstanceSettings,
    ReadSession,
    WriteSession,
)
from sonarium.api.pagination import Page, PageRequest, page_of, page_request
from sonarium.api.presenters import (
    audio_detail,
    audio_summaries,
    audio_summary,
    job_summary,
    share_summary,
    transcript_detail,
    transcript_summary,
    transcription_status,
)
from sonarium.api.schemas import (
    AudioDetail,
    AudioSummary,
    CreateShare,
    DuplicateWarning,
    JobSummary,
    MoveAudio,
    ShareSummary,
    TagSuggestion,
    TagSummary,
    TranscribeRequest,
    TranscriptDetail,
    TranscriptionStatus,
    TranscriptSummary,
    UpdateAudio,
)
from sonarium.core.errors import ConflictError, NotFoundError
from sonarium.core.levels import Level
from sonarium.db import tags as tag_repo
from sonarium.db import transcripts as transcript_repo
from sonarium.db.audio import (
    MetadataPatch,
    find_duplicates,
    list_audio_shares,
    move_audio,
    purge_audio,
    restore_audio,
    share_audio,
    trash_audio,
    trashed_audio,
    unshare_audio,
    update_metadata,
)
from sonarium.db.models import Library, Transcript, User
from sonarium.jobs import queue
from sonarium.media import storage

router = APIRouter(tags=["recordings"])

Paging = Annotated[PageRequest, Depends(page_request)]


@router.get("/audio", response_model=Page[AudioSummary], summary="Every recording you can see")
def list_audio(caller: CurrentCaller, session: ReadSession, paging: Paging) -> Page[AudioSummary]:
    query = audio_select(caller.id)
    total = len(session.execute(query).all())
    rows = session.execute(query.limit(paging.limit).offset(paging.offset)).all()
    return page_of(
        audio_summaries(session, [(row[0], row[1]) for row in rows]),
        total=total,
        request=paging,
    )


@router.get("/audio/{audio_uuid}", response_model=AudioDetail)
def get_audio(audio_uuid: str, caller: CurrentCaller, session: ReadSession) -> AudioDetail:
    audio, level = require_audio(session, caller.id, audio_uuid)
    return audio_detail(session, audio, level)


@router.patch("/audio/{audio_uuid}", response_model=AudioDetail)
def update_audio(
    audio_uuid: str, body: UpdateAudio, caller: CurrentCaller, session: WriteSession
) -> AudioDetail:
    """Change what a person may change. Requires edit; a reader is told so rather than refused
    as though the recording did not exist."""
    audio, level = update_metadata(
        session,
        caller.id,
        audio_uuid,
        MetadataPatch(
            title=body.title,
            notes=body.notes,
            recorded_at=body.recorded_at,
            recorded_at_offset=body.recorded_at_offset,
            category_id=body.category_id,
            clear_category=body.clear_category,
            tags=body.tags,
        ),
    )
    return audio_detail(session, audio, level)


@router.post("/audio/{audio_uuid}/move", response_model=AudioDetail)
def move(
    audio_uuid: str, body: MoveAudio, caller: CurrentCaller, session: WriteSession
) -> AudioDetail:
    """Move a recording into another library.

    Three consequences, all of which ``UI-19`` has to state before confirming: who can see it
    changes, the category is cleared, and grants made on the recording itself survive.
    """
    audio, level = move_audio(session, caller.id, audio_uuid, body.library_uuid)
    return audio_detail(session, audio, level)


@router.delete("/audio/{audio_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def trash(audio_uuid: str, caller: CurrentCaller, session: WriteSession) -> None:
    """Send a recording to the trash. There is no immediate hard delete anywhere."""
    trash_audio(session, caller.id, audio_uuid)


@router.post("/audio/{audio_uuid}/restore", response_model=AudioDetail)
def restore(audio_uuid: str, caller: CurrentCaller, session: WriteSession) -> AudioDetail:
    audio, level = restore_audio(session, caller.id, audio_uuid)
    return audio_detail(session, audio, level)


# --- Sharing one recording ------------------------------------------------


@router.get("/audio/{audio_uuid}/shares", response_model=list[ShareSummary])
def list_shares(audio_uuid: str, caller: CurrentCaller, session: ReadSession) -> list[ShareSummary]:
    """Everybody who can reach this recording, inherited and individual alike (``API-22``).

    Requires manage. An inherited row names the library this recording sits in and who
    administers it, which is the one thing an individual grant is meant not to hand over.
    """
    return [
        share_summary(share, grantee)
        for share, grantee in list_audio_shares(session, caller.id, audio_uuid)
    ]


@router.put("/audio/{audio_uuid}/shares", response_model=ShareSummary)
def share(
    audio_uuid: str, body: CreateShare, caller: CurrentCaller, session: WriteSession
) -> ShareSummary:
    """Grant this one recording, or change the level somebody already has on it. Requires manage.

    The grant reaches the recording and nothing around it: the library it sits in stays invisible.
    """
    granted = share_audio(
        session, caller.id, audio_uuid, grantee_id=body.grantee_id, level=body.level
    )
    grantee = session.get(User, body.grantee_id)
    if grantee is None:  # pragma: no cover -- share_audio already refused an unknown one
        raise NotFoundError("No such account.")
    return share_summary(granted, grantee)


@router.delete("/audio/{audio_uuid}/shares/{grantee_id}", status_code=status.HTTP_204_NO_CONTENT)
def unshare(audio_uuid: str, grantee_id: int, caller: CurrentCaller, session: WriteSession) -> None:
    """Revoke a grant made on this recording. An inherited one is revoked on its library."""
    unshare_audio(session, caller.id, audio_uuid, grantee_id=grantee_id)


@router.get("/trash/audio", response_model=Page[AudioSummary])
def list_trash(caller: CurrentCaller, session: ReadSession, paging: Paging) -> Page[AudioSummary]:
    """What is in the trash, with the closest to being purged first (``INT-1``)."""
    query = trashed_audio(caller.id)
    total = len(session.execute(query).all())
    rows = session.execute(query.limit(paging.limit).offset(paging.offset)).all()
    return page_of(
        audio_summaries(session, [(row[0], row[1]) for row in rows]),
        total=total,
        request=paging,
    )


@router.delete("/trash/audio/{audio_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def purge(
    audio_uuid: str,
    caller: CurrentCaller,
    database: ArchiveDatabase,
    settings: InstanceSettings,
) -> None:
    """Destroy one trashed recording now, rather than waiting out its retention (``API-19``).

    **In the trash namespace and not a flag on the trashing verb.** Deleting from the trash is
    what permanent deletion is, and separating the paths means the irreversible call cannot be
    reached by getting a query parameter wrong on the reversible one.

    It owns its transaction rather than taking :data:`WriteSession`, because the files go after
    the commit and holding the instance's one write lock across a filesystem walk would stop every
    other writer for its duration (``REV-1``).
    """
    with database.write_session() as session:
        removed = purge_audio(session, caller.id, audio_uuid)
    storage.delete_recording(settings.resolved_storage_dir, removed)


@router.get("/audio/duplicates/{sha256}", response_model=list[DuplicateWarning])
def duplicates(sha256: str, caller: CurrentCaller, session: ReadSession) -> list[DuplicateWarning]:
    """Whether this exact file is already here, trash included (``DEC-16``).

    Byte-identical only: a re-encoded copy of the same recording hashes differently, and the
    interface must not imply otherwise.
    """
    found = []
    for audio, in_trash in find_duplicates(session, caller.id, sha256):
        library = session.get(Library, audio.library_id)
        found.append(
            DuplicateWarning(
                uuid=audio.uuid,
                title=audio.title,
                in_trash=in_trash,
                library_uuid=library.uuid if library is not None else "",
            )
        )
    return found


# --- Transcripts ----------------------------------------------------------


@router.get("/audio/{audio_uuid}/transcripts", response_model=list[TranscriptSummary])
def list_transcripts(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession
) -> list[TranscriptSummary]:
    """Every transcript a recording has. Re-transcribing keeps the old ones (``UI-14``)."""
    audio, _ = require_audio(session, caller.id, audio_uuid)
    return [
        transcript_summary(session, transcript)
        for transcript in transcript_repo.list_transcripts(session, audio.id)
    ]


@router.get("/audio/{audio_uuid}/transcript", response_model=TranscriptDetail)
def get_active_transcript(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession
) -> TranscriptDetail:
    """The active transcript with its segments, which is what the detail view highlights."""
    audio, _ = require_audio(session, caller.id, audio_uuid)
    transcript = transcript_repo.active_transcript(session, audio.id)
    if transcript is None:
        raise NotFoundError("This recording has no transcript yet.")
    return transcript_detail(
        session, transcript, transcript_repo.segments_of(session, transcript.id)
    )


@router.post(
    "/audio/{audio_uuid}/transcripts/{transcript_id}/activate",
    response_model=TranscriptSummary,
)
def activate_transcript(
    audio_uuid: str, transcript_id: int, caller: CurrentCaller, session: WriteSession
) -> TranscriptSummary:
    """Switch which transcript is shown. Atomic, and it loses nothing."""
    audio, _ = require_audio(session, caller.id, audio_uuid, Level.EDIT)
    transcript = session.get(Transcript, transcript_id)
    if transcript is None or transcript.audio_id != audio.id:
        raise NotFoundError("No such transcript.")
    return transcript_summary(session, transcript_repo.activate(session, transcript_id))


@router.get(
    "/audio/{audio_uuid}/transcription",
    response_model=TranscriptionStatus,
    summary="What is happening to this recording's transcription",
)
def get_transcription_status(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession
) -> TranscriptionStatus:
    """The state, and the three facts about it that only exist on the job (``API-17``).

    Read level, the same as the recording itself: how a transcription of your own recording is
    going is not privileged information, and until this endpoint the only way to ask was the
    administrator-only queue -- so on a family instance the person whose recording had failed
    was the one person who could not find out why (``UI-15b``, ``UI-15c``).

    It reports and reaches out to nothing. Whether the provider is answering is ``INT-3c``'s
    explicit test, and a status endpoint that contacted it would make opening a recording an
    egress.
    """
    audio, _ = require_audio(session, caller.id, audio_uuid)
    return transcription_status(session, audio.id)


@router.post(
    "/audio/{audio_uuid}/transcribe",
    response_model=JobSummary,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ask for a transcription",
)
def transcribe_audio(
    audio_uuid: str, body: TranscribeRequest, caller: CurrentCaller, session: WriteSession
) -> JobSummary:
    """Queue a transcription, or say that one is already on its way (``API-11``).

    The call to action on a recording with no transcript, the retry after a failure and
    re-transcribing one that already has a good transcript are all this endpoint, which is why
    **a recording with a job already pending or running answers 409 rather than queueing a
    second one**. A double click must not cost two transcriptions, and the interface renders that
    409 as a state rather than as an error.

    Re-transcribing keeps what is there: ``JOB-7`` writes a new transcript and switches which one
    is active atomically, so nothing is lost while the new one is being made.
    """
    audio, _ = require_audio(session, caller.id, audio_uuid, Level.EDIT)
    job = queue.enqueue_transcription(
        session, audio_id=audio.id, audio_uuid=audio.uuid, language=body.language
    )
    if job is None:
        raise ConflictError("This recording is already being transcribed.")
    return job_summary(job, audio.uuid)


@router.post(
    "/audio/{audio_uuid}/transcribe/cancel",
    response_model=JobSummary,
    summary="Stop a transcription that is under way",
)
def cancel_transcription(
    audio_uuid: str, caller: CurrentCaller, session: WriteSession
) -> JobSummary:
    """Give up on the transcription in flight, and stop sending audio (``API-21``).

    Level 20, the same as asking for one: a transcription is somebody's provider quota and
    somebody's audio leaving the instance, and both directions of that decision belong to the
    people who can edit the recording.

    **Cancelling is a decision, not a failure.** The job goes to ``cancelled``, which is a state
    :mod:`sonarium.core.states` already reads as ``none`` -- so the recording comes back to its
    call to action rather than to an error nobody caused. Nothing is kept: no transcript is
    written from the parts that did finish, because a transcript covering the first four minutes
    of an hour is worse than none, and it would be the one thing on the screen claiming to be
    the recording's words.

    A recording with nothing in flight answers 409, mirroring the endpoint above: pressing cancel
    on a transcription that has just finished is the same race as pressing transcribe on one that
    has just started, and neither is an error worth showing.
    """
    audio, _ = require_audio(session, caller.id, audio_uuid, Level.EDIT)
    job = queue.cancel_transcription(session, audio.id)
    if job is None:
        raise ConflictError("This recording is not being transcribed.")
    return job_summary(job, audio.uuid)


# --- Tags -----------------------------------------------------------------


@router.get("/tags", response_model=list[TagSuggestion], tags=["tags"])
def suggest_tags(
    caller: CurrentCaller, session: ReadSession, prefix: str = "", limit: int = 10
) -> list[TagSuggestion]:
    """Tags on recordings you can read, and only those.

    An unfiltered suggestion list over a global vocabulary would be a directory of what everybody
    else on the instance records.
    """
    return [
        TagSuggestion(tag=TagSummary.model_validate(tag), uses=uses)
        for tag, uses in tag_repo.suggest_tags(session, caller.id, prefix, limit)
    ]


__all__ = ["audio_summary", "router"]
