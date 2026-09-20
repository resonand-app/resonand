"""Export and re-import (``ING-11``, ``DEC-5``).

**This is principle 1.** One command dumps audio, metadata and transcripts in a format that does
not need this software, and one command reads it back. It ships in the first version even though
nobody else will use it yet, because it is the promise the whole argument rests on and because
adding it later always gets postponed.

**One directory per recording, named for its ``uuid``.** The original, the sidecar and the derived
subtitles sit together in it, so two recordings uploaded under the same filename cannot overwrite
each other and no amount of punctuation in a filename can separate a sidecar from its audio. The
audio and the subtitles share a sanitised stem, which is what makes a media player find the
``.srt`` beside the recording.

The sidecar carries the recording's original ``uuid``, which is what makes **re-import
idempotent**: importing a recording that is already present updates it instead of creating a
second copy, and a transcript that is already here is not added a second time. Without that, the
export round-trip in the exit criteria doubles the archive rather than verifying it -- which is
the opposite of what an integrity check is for.

Timestamps follow ``DEC-11``. ``recorded_at`` goes out as the wall-clock reading it is, with its
offset in a separate field, so a round trip through the export cannot quietly shift a recording
into another timezone. Its source and its precision travel with it, because neither can be
recovered on the way back in: the file is re-ingested under a stored name, and a reading that
stated only a day is indistinguishable from a midnight once the two are apart.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from sonarium import __version__
from sonarium.core.formats import normalise_extension
from sonarium.core.time import now_instant
from sonarium.db import search_index, tags, transcripts
from sonarium.db.models import Audio, Category, Library, Transcript
from sonarium.db.transcripts import Origin, SegmentDraft
from sonarium.media import storage
from sonarium.media.subtitles import Cue, to_srt, to_vtt

SIDECAR_VERSION = 1
SIDECAR_NAME = "sonarium.json"
SIDECAR_SUFFIX = ".sonarium.json"
"""What a sidecar was called when it shared a directory with every other recording.

Still read on import, because a sidecar somebody wrote by hand next to a single file is a
reasonable thing to hand this command, and refusing it would buy nothing.
"""


@dataclass(frozen=True, slots=True)
class ExportedRecording:
    """What one recording's export produced."""

    uuid: str
    directory: Path
    audio: Path
    sidecar: Path
    subtitles: tuple[Path, ...]


def sidecar_for(session: Session, audio: Audio) -> dict[str, Any]:
    """Everything about one recording, in a shape that needs no software to read."""
    library = session.get(Library, audio.library_id)
    category = session.get(Category, audio.category_id) if audio.category_id else None
    transcript = transcripts.active_transcript(session, audio.id)
    segments = transcripts.segments_of(session, transcript.id) if transcript else []
    return {
        "sonarium": {
            "sidecar_version": SIDECAR_VERSION,
            "exported_at": now_instant(),
            "version": __version__,
        },
        "uuid": audio.uuid,
        "title": audio.title,
        "notes": audio.notes,
        "recorded_at": audio.recorded_at,
        "recorded_at_offset_minutes": audio.recorded_at_offset,
        "recorded_at_source": audio.recorded_at_source,
        "recorded_at_precision": audio.recorded_at_precision,
        "created_at": audio.created_at,
        "library": {"uuid": library.uuid, "name": library.name} if library else None,
        "category": category.name if category else None,
        "tags": [tag.name for tag in tags.tags_for_audio(session, audio.id)],
        "original_filename": audio.original_filename,
        "sha256": audio.sha256,
        "size_bytes": audio.size_bytes,
        "duration_ms": audio.duration_ms,
        "mime": audio.mime,
        "codec": audio.codec,
        "sample_rate": audio.sample_rate,
        "channels": audio.channels,
        "transcript": (
            {
                "provider": transcript.provider,
                "model": transcript.model,
                "language": transcript.language,
                "source": transcript.source,
                "task": transcript.task,
                "stitched_from": transcript.stitched_from,
                "created_at": transcript.created_at,
                "segments": [
                    {
                        "start_ms": segment.start_ms,
                        "end_ms": segment.end_ms,
                        "speaker": segment.speaker,
                        "text": segment.text,
                    }
                    for segment in segments
                ],
            }
            if transcript
            else None
        ),
    }


def export_recording(
    session: Session,
    audio: Audio,
    destination: Path,
    storage_root: Path,
    *,
    copy_audio: bool = True,
) -> ExportedRecording:
    """Write one recording out: the original, the sidecar, and the derived subtitles.

    ``destination`` is the root of the export, and this writes into ``destination/<uuid>/``.

    The original is copied through a buffer rather than read into memory: an export is the one
    command that touches every byte in the archive, and a multi-gigabyte recording would take the
    process down with it (``REV-9``).
    """
    directory = destination / audio.uuid
    directory.mkdir(parents=True, exist_ok=True)
    stem = _safe_stem(audio)
    sidecar_path = directory / SIDECAR_NAME
    payload = sidecar_for(session, audio)
    sidecar_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    audio_path = directory / f"{stem}{_extension(audio)}"
    if copy_audio:
        source = storage.resolve(storage_root, audio.storage_path)
        if source.exists():
            shutil.copyfile(source, audio_path)

    written: list[Path] = []
    transcript = payload.get("transcript")
    if isinstance(transcript, dict) and transcript.get("segments"):
        cues = [
            Cue(start_ms=int(row["start_ms"]), end_ms=int(row["end_ms"]), text=str(row["text"]))
            for row in transcript["segments"]
        ]
        for suffix, rendered in ((".vtt", to_vtt(cues)), (".srt", to_srt(cues))):
            path = directory / f"{stem}{suffix}"
            path.write_text(rendered, encoding="utf-8")
            written.append(path)

    return ExportedRecording(
        uuid=audio.uuid,
        directory=directory,
        audio=audio_path,
        sidecar=sidecar_path,
        subtitles=tuple(written),
    )


def read_sidecar(path: Path) -> dict[str, Any]:
    """Read a sidecar, refusing a version this build does not understand."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name} is not a Sonarium sidecar.")
    header = payload.get("sonarium") or {}
    version = header.get("sidecar_version")
    if version != SIDECAR_VERSION:
        raise ValueError(
            f"{path.name} is sidecar version {version}, and this build reads {SIDECAR_VERSION}."
        )
    return payload


def apply_sidecar(session: Session, audio: Audio, payload: dict[str, Any]) -> None:
    """Put a sidecar's metadata onto a recording.

    Used by both halves of the round trip: importing a new recording, and updating one that is
    already here because the sidecar carried its ``uuid``.
    """
    audio.title = str(payload.get("title") or audio.title)
    audio.notes = payload.get("notes") or None
    audio.recorded_at = payload.get("recorded_at") or None
    audio.recorded_at_offset = payload.get("recorded_at_offset_minutes")
    audio.recorded_at_source = payload.get("recorded_at_source") or None
    audio.recorded_at_precision = payload.get("recorded_at_precision") or None
    if payload.get("original_filename"):
        # The file in an export is written under a sanitised stem, so the name the recording was
        # uploaded under -- which is the name a download gives back -- only survives here.
        audio.original_filename = str(payload["original_filename"])
    audio.category_id = _category_id_for(session, audio.library_id, payload.get("category"))
    if payload.get("tags"):
        tags.set_audio_tags(session, audio.id, [str(name) for name in payload["tags"]])
    transcript = payload.get("transcript")
    if isinstance(transcript, dict) and transcript.get("segments"):
        _apply_transcript(session, audio, transcript)
    session.flush()
    search_index.index_audio(session, audio.id)


def find_by_uuid(session: Session, uuid: str) -> Audio | None:
    """A recording already in the archive under this identifier, trash included.

    Deliberately not going through the ACL: this runs from the command line, as whoever
    administers the instance, over their own files. The ACL protects accounts from each other,
    and the person holding the database file is not one of the accounts.
    """
    return session.execute(select(Audio).where(Audio.uuid == uuid)).scalar_one_or_none()


def library_named_by(session: Session, payload: dict[str, Any]) -> Library | None:
    """The library a sidecar names, when this instance still has it.

    An export read back into the instance it came from goes into the libraries it came out of,
    rather than collapsing the whole archive into one. An export read into an empty instance
    finds nothing here and has to be told where to put things, which is what ``--library`` is
    for. A library that is in the trash does not count: importing into it would put the
    recording somewhere nobody is looking.
    """
    named = payload.get("library")
    if not isinstance(named, dict) or not named.get("uuid"):
        return None
    return session.execute(
        select(Library).where(Library.uuid == str(named["uuid"]), Library.deleted_at.is_(None))
    ).scalar_one_or_none()


def _apply_transcript(session: Session, audio: Audio, payload: dict[str, Any]) -> None:
    """Add the sidecar's transcript, unless the recording already has exactly this one.

    A recording keeps every transcript it has ever had, so a duplicate is indistinguishable from
    a real second attempt with a better model -- and re-importing the same export would grow one
    a run.
    """
    drafts = [
        SegmentDraft(
            start_ms=int(row["start_ms"]),
            end_ms=int(row["end_ms"]),
            text=str(row["text"]),
            speaker=row.get("speaker"),
        )
        for row in payload["segments"]
    ]
    origin = Origin(
        source="imported",
        provider=payload.get("provider"),
        model=payload.get("model"),
        language=payload.get("language"),
        # A sidecar written before these existed carries neither, and the defaults are what such
        # a transcript actually was: a transcription, of unrecorded shape.
        task=str(payload.get("task") or "transcribe"),
        stitched_from=payload.get("stitched_from"),
    )
    already = _transcript_matching(session, audio.id, origin, drafts)
    if already is None:
        transcripts.create_transcript(session, audio.id, drafts, origin)
    elif not already.is_active:
        transcripts.activate(session, already.id)


def _transcript_matching(
    session: Session, audio_id: int, origin: Origin, drafts: list[SegmentDraft]
) -> Transcript | None:
    """A transcript this recording already has that says the same thing as the sidecar's.

    ``source`` is not compared. A transcript an engine produced goes out as ``service`` and comes
    back as ``imported``, which is honest about how the row got here and would make every round
    trip look like new content.
    """
    wanted = (origin.provider, origin.model, origin.language, origin.task, origin.stitched_from)
    timings = [(draft.start_ms, draft.end_ms, draft.speaker, draft.text) for draft in drafts]
    for transcript in transcripts.list_transcripts(session, audio_id):
        provenance = (
            transcript.provider,
            transcript.model,
            transcript.language,
            transcript.task,
            transcript.stitched_from,
        )
        if provenance != wanted:
            continue
        segments = transcripts.segments_of(session, transcript.id)
        if [(s.start_ms, s.end_ms, s.speaker, s.text) for s in segments] == timings:
            return transcript
    return None


def _category_id_for(session: Session, library_id: int, name: object) -> int | None:
    """The category of this name in this library, created if it is not here yet.

    Not routed through ``db.categories``: that module resolves permissions, and this runs as
    whoever holds the database rather than as an account (see :func:`find_by_uuid`). The sidecar
    carries a name and not a path, because the interface has one level of categories -- a nested
    one comes back as a root.
    """
    if not isinstance(name, str) or not name.strip():
        return None
    cleaned = " ".join(name.split())
    existing = session.execute(
        select(Category).where(
            Category.library_id == library_id,
            Category.parent_id.is_(None),
            Category.name == cleaned,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return int(existing.id)
    highest = session.execute(
        select(func.max(Category.position)).where(
            Category.library_id == library_id, Category.parent_id.is_(None)
        )
    ).scalar_one_or_none()
    category = Category(
        library_id=library_id,
        name=cleaned,
        position=0 if highest is None else int(highest) + 1,
    )
    session.add(category)
    session.flush()
    return int(category.id)


def _extension(audio: Audio) -> str:
    """The suffix the exported audio keeps, so re-importing it is accepted as what it is."""
    return normalise_extension(audio.original_filename or "") or Path(audio.storage_path).suffix


def _safe_stem(audio: Audio) -> str:
    """A filename for the export that will survive being copied between filesystems."""
    base = (audio.original_filename or audio.title or audio.uuid).rsplit("/", 1)[-1]
    if "." in base[1:]:
        base = base.rsplit(".", 1)[0]
    cleaned = "".join(
        character if character.isalnum() or character in " -_." else "-" for character in base
    )
    return cleaned.strip(" -.") or audio.uuid
