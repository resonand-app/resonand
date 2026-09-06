"""What the worker actually does with a claimed job (``ING-4``, ``ING-5``, ``ING-6``, ``JOB-13``).

Each handler is a plain function: it gets the work and the things it needs, it does one thing, and
it returns. The database is touched in short write transactions at the start and the end, never
across the ffmpeg call in between -- holding the single write lock for the length of a transcode
would stop every other request in the instance.

The chain after an upload is probe, then waveform and transcode in parallel, then transcription
if it was asked for. Probe comes first because it establishes the duration everything else needs:
the waveform's bucket count, the parts a long recording is split into, and the metering.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import structlog
from sqlalchemy.orm import Session

from sonarium.core.config import Settings
from sonarium.core.errors import NotFoundError
from sonarium.db import search_index, transcripts
from sonarium.db.engine import Database
from sonarium.db.models import Audio
from sonarium.db.transcripts import Origin, SegmentDraft
from sonarium.jobs import retention
from sonarium.jobs.queue import (
    KIND_TRANSCODE,
    KIND_TRANSCRIBE,
    KIND_WAVEFORM,
    Work,
    enqueue,
)
from sonarium.media import recorded_at as recorded_at_module
from sonarium.media import storage, transcode, waveform
from sonarium.media.probe import probe
from sonarium.transcription.chunking import (
    detect_silences,
    max_part_ms_for,
    plan_parts,
    restitch,
)
from sonarium.transcription.contract import TranscriptionProvider, TranscriptionRequest

_logger = structlog.get_logger(__name__)


@dataclass(frozen=True, slots=True)
class Context:
    """Everything a handler is allowed to reach."""

    database: Database
    settings: Settings
    provider: TranscriptionProvider | None = None

    @property
    def storage_root(self) -> Path:
        return self.settings.resolved_storage_dir


def handle_probe(work: Work, context: Context) -> None:
    """Read the technical metadata, and work out when the recording was made.

    ``ING-12`` runs here rather than in its own job because it needs the container tags that
    ``ffprobe`` has just read, and probing twice to keep the two apart would be a second walk over
    a multi-gigabyte file for nothing.
    """
    audio_uuid, path = _locate(work, context)
    with context.database.read_session() as session:
        uploaded_as = _require(session, work).original_filename
    details = probe(path)
    derived = recorded_at_module.derive(
        path,
        format_tags=details.format_tags,
        # The name the file arrived under, not the name it is stored as. Every original on
        # disk is called ``original.<ext>``, so passing the stored path here would silently
        # skip the filename source entirely -- which is the one that rescues an imported
        # archive of PTT-20240311-WA0007.opus.
        original_filename=uploaded_as or path.name,
    )
    with context.database.write_session() as session:
        audio = _require(session, work)
        audio.duration_ms = details.duration_ms
        audio.sample_rate = details.sample_rate
        audio.channels = details.channels
        audio.codec = details.codec
        audio.mime = details.mime
        audio.size_bytes = details.size_bytes
        if derived is not None and audio.recorded_at is None:
            audio.recorded_at = derived.wall_clock
            audio.recorded_at_offset = derived.offset_minutes
        session.flush()
        enqueue(session, KIND_WAVEFORM, audio_id=audio.id, idempotency_key=f"waveform:{audio_uuid}")
        enqueue(
            session, KIND_TRANSCODE, audio_id=audio.id, idempotency_key=f"transcode:{audio_uuid}"
        )


def handle_waveform(work: Work, context: Context) -> None:
    """Compute the peaks, which are the recording's thumbnail."""
    _, path = _locate(work, context)
    peaks = waveform.compute(path, peaks_per_second=context.settings.waveform_peaks_per_second)
    blob = waveform.encode(peaks)
    # Stored at the configured rate, in full. `ING-14` reduces it per request instead, so one
    # recording serves the 20px row and the 130px detail view without storing either.
    with context.database.write_session() as session:
        _require(session, work).waveform = blob


def handle_transcode(work: Work, context: Context) -> None:
    """Produce the Opus derivative the browser plays."""
    audio_uuid, path = _locate(work, context)
    destination = storage.derived_path(context.storage_root, audio_uuid)
    transcode.to_opus(path, destination)
    with context.database.write_session() as session:
        _require(session, work).derived_path = storage.relative(context.storage_root, destination)


def handle_transcribe(work: Work, context: Context) -> None:
    """Transcribe a recording, splitting it if it is long (``JOB-13``).

    The parts are cut from the file on disk and submitted one at a time. Each one's segments are
    offset by where it started, which is the difference between a transcript that plays correctly
    and one that reads correctly and plays wrong.
    """
    if context.provider is None:
        raise NotFoundError("No transcription provider is configured.")
    audio_uuid, path = _locate(work, context)
    with context.database.read_session() as session:
        audio = _require(session, work)
        duration_ms = audio.duration_ms or 0
        audio_id = audio.id
        uploader = audio.uploaded_by
    language = work.payload.get("language")

    ceiling = min(
        context.settings.transcription_max_part_seconds * 1000,
        max_part_ms_for(context.settings.transcription_request_max_bytes),
    )
    silences = detect_silences(path) if duration_ms > ceiling else ()
    plan = plan_parts(
        duration_ms or ceiling,
        silences=silences,
        max_part_ms=ceiling,
        overlap_ms=int(context.settings.transcription_overlap_seconds * 1000),
    )

    per_part = []
    detected: str | None = None
    working = storage.recording_dir(context.storage_root, audio_uuid)
    for part in plan.parts:
        source = path
        if not plan.is_single:
            source = transcode.extract_part(
                path,
                working / f".part-{part.index:04d}.opus",
                start_ms=part.start_ms,
                duration_ms=part.duration_ms,
            )
        try:
            handle = context.provider.submit(
                TranscriptionRequest(
                    audio=source,
                    duration_ms=part.duration_ms,
                    user_id=uploader,
                    audio_id=audio_id,
                    filename=f"{audio_uuid}-{part.index}.opus",
                    language=language if isinstance(language, str) else None,
                )
            )
            result = context.provider.poll(handle)
            if result is None:
                raise NotFoundError("The provider accepted the audio but returned no result.")
            detected = detected or result.language
            per_part.append(list(result.segments))
        finally:
            if not plan.is_single:
                source.unlink(missing_ok=True)

    stitched = restitch(plan, per_part)
    with context.database.write_session() as session:
        transcripts.create_transcript(
            session,
            audio_id,
            [
                SegmentDraft(
                    start_ms=segment.start_ms,
                    end_ms=segment.end_ms,
                    text=segment.text,
                    speaker=segment.speaker,
                )
                for segment in stitched
            ],
            Origin(
                source="service",
                provider=context.provider.name,
                model=context.provider.model,
                language=detected,
            ),
        )
        search_index.index_audio(session, audio_id)


def handle_purge(work: Work, context: Context) -> None:
    """Empty the trash of everything past its retention (``INT-2``).

    The row goes inside a transaction and the file goes after it, deliberately: a crash
    between the two leaves an orphaned file, which ``sonarium fsck`` reports and an operator
    can delete. The other order would leave a row pointing at a file that is gone, which
    reads as data loss.
    """
    del work
    days = context.settings.trash_retention_days
    with context.database.write_session() as session:
        uuids = [
            retention.remove_recording(session, audio)
            for audio in retention.expired_recordings(session, days)
        ]
        libraries = retention.expired_libraries(session, days)
        for library in libraries:
            session.delete(library)
        expired_sessions = retention.purge_sessions(session)

    removed = sum(storage.delete_recording(context.storage_root, uuid) for uuid in uuids)
    if uuids or libraries or expired_sessions:
        _logger.info(
            "trash.purged",
            recordings=len(uuids),
            libraries=len(libraries),
            files=removed,
            sessions=expired_sessions,
            retention_days=days,
        )


HANDLERS = {
    "probe": handle_probe,
    KIND_WAVEFORM: handle_waveform,
    KIND_TRANSCODE: handle_transcode,
    KIND_TRANSCRIBE: handle_transcribe,
    retention.KIND_PURGE: handle_purge,
}


def _locate(work: Work, context: Context) -> tuple[str, Path]:
    """The recording's public identifier and where its original is."""
    with context.database.read_session() as session:
        audio = _require(session, work)
        stored = audio.storage_path
        audio_uuid = audio.uuid
    path = storage.resolve(context.storage_root, stored)
    if not path.exists():
        raise NotFoundError(
            f"The original file for {audio_uuid} is missing from storage. Run sonarium fsck."
        )
    return audio_uuid, path


def _require(session: Session, work: Work) -> Audio:
    """The recording this job is about, or a failure that says which one is gone."""
    if work.audio_id is None:
        raise NotFoundError(f"Job {work.id} has no recording attached.")
    audio = session.get(Audio, work.audio_id)
    if audio is None:
        raise NotFoundError(f"Recording {work.audio_id} has gone.")
    return audio


def payload_of(work: Work) -> str:
    """The job's payload as it is stored, for the administration view."""
    return json.dumps(work.payload, sort_keys=True)
