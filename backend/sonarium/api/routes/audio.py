"""Recordings: metadata, the trash, moving and transcripts (``API-9``).

Nothing here checks a permission. Every function reaches the database through
:mod:`sonarium.acl.query`, which is also what makes a recording somebody may not read answer 404
rather than 403 without any endpoint having to remember to.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from sonarium.acl.query import audio_select, require_audio
from sonarium.api.deps import CurrentCaller, ReadSession, WriteSession
from sonarium.api.pagination import Page, PageRequest, page_of, page_request
from sonarium.api.presenters import (
    audio_detail,
    audio_summaries,
    audio_summary,
    transcript_detail,
    transcript_summary,
)
from sonarium.api.schemas import (
    AudioDetail,
    AudioSummary,
    DuplicateWarning,
    MoveAudio,
    TagSuggestion,
    TagSummary,
    TranscriptDetail,
    TranscriptSummary,
    UpdateAudio,
)
from sonarium.core.errors import NotFoundError
from sonarium.core.levels import Level
from sonarium.db import tags as tag_repo
from sonarium.db import transcripts as transcript_repo
from sonarium.db.audio import (
    MetadataPatch,
    find_duplicates,
    move_audio,
    restore_audio,
    trash_audio,
    trashed_audio,
    update_metadata,
)
from sonarium.db.models import Library, Transcript

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
    audio = update_metadata(
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
    _, level = require_audio(session, caller.id, audio_uuid)
    return audio_detail(session, audio, level)


@router.post("/audio/{audio_uuid}/move", response_model=AudioDetail)
def move(
    audio_uuid: str, body: MoveAudio, caller: CurrentCaller, session: WriteSession
) -> AudioDetail:
    """Move a recording into another library.

    Three consequences, all of which ``UI-19`` has to state before confirming: who can see it
    changes, the category is cleared, and grants made on the recording itself survive.
    """
    audio = move_audio(session, caller.id, audio_uuid, body.library_uuid)
    _, level = require_audio(session, caller.id, audio_uuid)
    return audio_detail(session, audio, level)


@router.delete("/audio/{audio_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def trash(audio_uuid: str, caller: CurrentCaller, session: WriteSession) -> None:
    """Send a recording to the trash. There is no immediate hard delete anywhere."""
    trash_audio(session, caller.id, audio_uuid)


@router.post("/audio/{audio_uuid}/restore", response_model=AudioDetail)
def restore(audio_uuid: str, caller: CurrentCaller, session: WriteSession) -> AudioDetail:
    audio = restore_audio(session, caller.id, audio_uuid)
    _, level = require_audio(session, caller.id, audio_uuid, include_trashed=True)
    return audio_detail(session, audio, level)


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
