"""Getting audio in, and getting it back out (``ING-2``, ``ING-7``, ``ING-8``).

Three endpoints that between them carry principle 1. Upload writes the original once and never
touches it again; streaming serves the derivative for playback; download hands back the original
under the name it arrived with, byte for byte.

Nothing here does any processing. The upload writes the file, records the row and queues the
work; ffprobe, the waveform, the transcode and any transcription happen in the worker, because a
browser will not wait for an hour of driving to be transcoded and a request that did would hold
the single write lock while it ran.

For the same reason **no session is open while the bytes are moving** (``REV-1``). Upload and
playback take the database rather than a session and reach for one where the rows are, which is
why they are the only endpoints in the application that manage their own transactions.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session as DbSession
from starlette.responses import FileResponse, StreamingResponse

from sonarium.acl.query import require_audio, require_library
from sonarium.api.deps import (
    ArchiveDatabase,
    Caller,
    CurrentCaller,
    InstanceSettings,
    ReadSession,
    optional_caller,
    settings_of,
)
from sonarium.api.presenters import audio_detail
from sonarium.api.schemas import AudioDetail, DuplicateWarning
from sonarium.api.stream_tokens import issue, redeem
from sonarium.core.config import Settings
from sonarium.core.errors import InvalidRequestError, NotFoundError
from sonarium.core.formats import is_accepted
from sonarium.core.ids import new_uuid
from sonarium.core.levels import Level
from sonarium.core.time import now_instant
from sonarium.db.audio import create_audio, find_duplicates
from sonarium.jobs.queue import KIND_TRANSCRIBE, enqueue
from sonarium.media import ranges, storage

router = APIRouter(tags=["ingestion"])

PLAYBACK_MIME = "audio/ogg"

MaybeCaller = Annotated[Caller | None, Depends(optional_caller)]
"""The streaming endpoint accepts either a session or a playback token, so the session is
optional here and only here -- and a request with neither still ends in a 404."""


@router.post(
    "/libraries/{library_uuid}/audio",
    response_model=AudioDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a recording",
)
def upload(
    library_uuid: str,
    caller: CurrentCaller,
    session: ReadSession,
    database: ArchiveDatabase,
    settings: InstanceSettings,
    file: Annotated[UploadFile, File(description="The recording, in any accepted format.")],
    transcribe: Annotated[bool, Form()] = False,
    language: Annotated[str | None, Form()] = None,
) -> AudioDetail:
    """Store a recording and queue the work that turns it into an archived one.

    The bytes are written and hashed in one pass -- an hours-long upload is not walked twice --
    and the original is never rewritten afterwards.

    **The database is not touched while they are arriving** (``REV-1``). The identifier is minted
    here rather than by the insert, so the file can be written under its final name with nothing
    open, and the row that describes it goes in afterwards in one short transaction. An upload
    that held the write lock would stop every other writer in the instance -- the worker
    included -- for as long as the upload took, which for an hour of driving is an hour.

    The permission is resolved twice deliberately: once before a byte is accepted, so a stranger
    is refused rather than served eight gigabytes of patience, and once inside the transaction
    that writes, which is the one that decides.
    """
    require_library(session, caller.id, library_uuid, Level.EDIT)
    filename = file.filename or "recording"
    if not is_accepted(filename):
        raise InvalidRequestError(
            f"{filename!r} is not a format this archive ingests. Audio files and video "
            "containers are accepted; a video's audio is what gets played."
        )

    audio_uuid = new_uuid()
    try:
        path, digest = storage.store_original(
            settings.resolved_storage_dir,
            audio_uuid,
            _limited(file, settings.max_upload_bytes),
            filename=filename,
        )
        with database.write_session() as write:
            library, _ = require_library(write, caller.id, library_uuid, Level.EDIT)
            audio = create_audio(
                write,
                uuid=audio_uuid,
                library_id=library.id,
                uploaded_by=caller.id,
                storage_path=storage.relative(settings.resolved_storage_dir, path),
                original_filename=filename,
                sha256=digest.sha256,
                size_bytes=digest.size_bytes,
            )
            enqueue(write, "probe", audio_id=audio.id, idempotency_key=f"probe:{audio_uuid}")
            if transcribe:
                enqueue(
                    write,
                    KIND_TRANSCRIBE,
                    audio_id=audio.id,
                    payload={"language": language} if language else {},
                    idempotency_key=f"transcribe:{audio_uuid}",
                )
            return audio_detail(write, audio, Level.OWNER)
    except BaseException:
        # Whatever went wrong -- a file over the limit, a permission withdrawn between the two
        # checks, a failed commit -- the bytes belong to a recording that does not exist. They
        # are removed here rather than left for `fsck` to report, because an upload that failed
        # should cost the archive nothing.
        storage.delete_recording(settings.resolved_storage_dir, audio_uuid)
        raise


@router.get(
    "/audio/{audio_uuid}/duplicates",
    response_model=list[DuplicateWarning],
    summary="Is this exact file already here",
)
def check_duplicate(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession
) -> list[DuplicateWarning]:
    """Byte-identical copies of a stored recording, the trash included (``DEC-16``)."""
    audio, _ = require_audio(session, caller.id, audio_uuid)
    if audio.sha256 is None:
        return []
    return [
        DuplicateWarning(uuid=other.uuid, title=other.title, in_trash=in_trash, library_uuid="")
        for other, in_trash in find_duplicates(session, caller.id, audio.sha256)
        if other.id != audio.id
    ]


@router.post("/audio/{audio_uuid}/playback-token", summary="A short-lived link for the player")
def playback_token(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession, settings: InstanceSettings
) -> dict[str, str]:
    """Mint a token the ``<audio>`` element can carry in its URL.

    The real permissions are checked here; the token only records that the check happened.
    """
    require_audio(session, caller.id, audio_uuid)
    secret = settings.secret_key
    if secret is None:
        raise InvalidRequestError(
            "This instance has no SONARIUM_SECRET_KEY, so playback links cannot be signed."
        )
    return {"token": issue(secret, audio_uuid, caller.id), "issued_at": now_instant()}


@router.get("/audio/{audio_uuid}/stream", summary="Play a recording")
def stream(
    audio_uuid: str,
    request: Request,
    caller: MaybeCaller,
    settings: Annotated[Settings, Depends(settings_of)],
    database: ArchiveDatabase,
    token: Annotated[str | None, Query(description="A playback token, for <audio>.")] = None,
) -> Response:
    """Serve the Opus derivative, honouring ``Range`` so that seeking works.

    Falls back to the original when there is no derivative yet, so a recording is playable the
    moment it is uploaded rather than only once the worker has caught up.
    """
    with database.read_session() as session:
        user_id = _who(session, caller, settings, audio_uuid, token)
        audio, _ = require_audio(session, user_id, audio_uuid)
        derived = audio.derived_path
        original = audio.storage_path
    root = settings.resolved_storage_dir
    path = storage.resolve(root, derived) if derived else storage.resolve(root, original)
    if not path.exists():
        raise NotFoundError("The audio for this recording is missing from storage.")
    return _ranged(path, request.headers.get("range"), PLAYBACK_MIME if derived else None)


@router.get("/audio/{audio_uuid}/original", summary="Download the original")
def download(
    audio_uuid: str, caller: CurrentCaller, session: ReadSession, settings: InstanceSettings
) -> FileResponse:
    """The file exactly as it arrived, under the name it arrived with.

    Principle 1 at its most literal: whatever else happens, the bytes you put in come back out.
    """
    audio, _ = require_audio(session, caller.id, audio_uuid)
    path = storage.resolve(settings.resolved_storage_dir, audio.storage_path)
    if not path.exists():
        raise NotFoundError("The original file for this recording is missing from storage.")
    return FileResponse(
        path,
        media_type=audio.mime or "application/octet-stream",
        filename=audio.original_filename or path.name,
    )


@router.get("/audio/{audio_uuid}/waveform", summary="The recording's peaks")
def waveform_blob(audio_uuid: str, caller: CurrentCaller, session: ReadSession) -> Response:
    """The stored peaks, as the compact binary they are stored as.

    Expanded into JSON, a grid of eighty cards would pull tens of megabytes to draw eighty small
    pictures.
    """
    audio, _ = require_audio(session, caller.id, audio_uuid)
    if audio.waveform is None:
        raise NotFoundError("This recording has no waveform yet.")
    return Response(
        content=audio.waveform,
        media_type="application/octet-stream",
        headers={"Cache-Control": "private, max-age=86400"},
    )


def _limited(file: UploadFile, limit: int) -> Iterator[bytes]:
    """Yield the upload's bytes, refusing once it goes past the limit.

    Checked while streaming rather than from ``Content-Length``, which a client controls and can
    simply lie about.
    """
    written = 0
    while True:
        chunk = file.file.read(ranges.CHUNK_BYTES)
        if not chunk:
            return
        written += len(chunk)
        if written > limit:
            raise InvalidRequestError(
                f"This file is larger than this instance accepts "
                f"({limit // (1024 * 1024)} MB). Raise SONARIUM_MAX_UPLOAD_BYTES if that is not "
                "what you meant."
            )
        yield chunk


def _ranged(path: Path, range_header: str | None, media_type: str | None) -> Response:
    """Serve a file whole or in part."""
    size = path.stat().st_size
    try:
        span = ranges.parse_range(range_header, size)
    except ranges.UnsatisfiableRangeError:
        return Response(
            status_code=status.HTTP_416_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{size}"},
        )
    if span is None:
        return FileResponse(path, media_type=media_type, headers={"Accept-Ranges": "bytes"})
    return StreamingResponse(
        _read_span(path, span),
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=media_type,
        headers={
            "Content-Range": span.content_range(size),
            "Content-Length": str(span.length),
            "Accept-Ranges": "bytes",
        },
    )


def _read_span(path: Path, span: ranges.ByteRange) -> Iterator[bytes]:
    """Read one span of a file without holding it in memory."""
    remaining = span.length
    with path.open("rb") as handle:
        handle.seek(span.start)
        while remaining > 0:
            chunk = handle.read(min(ranges.CHUNK_BYTES, remaining))
            if not chunk:
                return
            remaining -= len(chunk)
            yield chunk


def _who(
    session: DbSession,
    caller: Caller | None,
    settings: Settings,
    audio_uuid: str,
    token: str | None,
) -> int:
    """Whose request this is: the session if there is one, otherwise the playback token."""
    del session
    if caller is not None:
        return caller.id
    if token and settings.secret_key is not None:
        return redeem(settings.secret_key, token, audio_uuid)
    raise NotFoundError("No such recording.")
