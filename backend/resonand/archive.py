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

**The manifest describes the instance, and never how to sign in to it.**
``resonand-archive.json`` at the root of an export carries the accounts a recording could belong
to, the libraries, and who each was shared with -- identities, not credentials. An import
recreates the libraries and the sharing against accounts that are already here and refuses a
library whose owner is not, because an export gets copied onto a stick and handed around, and one
that carried password hashes would be a way into an instance rather than a description of one.
Restoring an instance whole, credentials included, is what a backup is for (``OPS-6``).

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

from resonand import __version__
from resonand.core import colours
from resonand.core.errors import NotFoundError
from resonand.core.formats import normalise_extension
from resonand.core.levels import GRANTABLE, Level
from resonand.core.time import now_instant
from resonand.db import libraries as libraries_repo
from resonand.db import search_index, tags, transcripts, users
from resonand.db.models import Audio, Category, Library, Share, Transcript, User
from resonand.db.transcripts import Origin, SegmentDraft
from resonand.media import storage
from resonand.media.subtitles import Cue, to_srt, to_vtt

MANIFEST_VERSION = 1
MANIFEST_NAME = "resonand-archive.json"

SIDECAR_VERSION = 1
SIDECAR_NAME = "resonand.json"
SIDECAR_SUFFIX = ".resonand.json"
"""What a sidecar was called when it shared a directory with every other recording.

Still read on import, because a sidecar somebody wrote by hand next to a single file is a
reasonable thing to hand this command, and refusing it would buy nothing.
"""

HEADER_KEY = "resonand"

LEGACY_MANIFEST_NAME = "sonarium-archive.json"
LEGACY_SIDECAR_NAME = "sonarium.json"
LEGACY_SIDECAR_SUFFIX = ".sonarium.json"
LEGACY_HEADER_KEY = "sonarium"
"""What the format was called before the project was renamed (``NAM-4``).

Read and never written, which is the whole of it: an export is the one artefact built to outlive
the instance that wrote it, so a reader that refused the format it was writing last month would
undercut the single feature whose claim is longevity. An export written under the old name is
still somebody's archive sitting on a disk, and it is the only copy they may have.
"""


@dataclass(frozen=True, slots=True)
class ExportedRecording:
    """What one recording's export produced."""

    uuid: str
    directory: Path
    audio: Path
    sidecar: Path
    subtitles: tuple[Path, ...]


@dataclass(frozen=True, slots=True)
class ManifestApplied:
    """What reading an archive manifest into an instance did, and what it could not do."""

    libraries: dict[str, int]
    """The manifest's library uuid to the library it resolved to here."""

    missing_accounts: tuple[str, ...]
    """Addresses the export names that have no account here. Somebody has to create them."""

    refused_libraries: tuple[str, ...]
    """Libraries not recreated, because their owner is one of the addresses above."""


def sidecar_for(session: Session, audio: Audio) -> dict[str, Any]:
    """Everything about one recording, in a shape that needs no software to read."""
    library = session.get(Library, audio.library_id)
    category = session.get(Category, audio.category_id) if audio.category_id else None
    transcript = transcripts.active_transcript(session, audio.id)
    segments = transcripts.segments_of(session, transcript.id) if transcript else []
    return {
        "resonand": {
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
        "shares": _shares_on(session, audio_id=audio.id),
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


def _header(payload: dict[str, Any]) -> dict[str, Any]:
    """The envelope, under either spelling of the key."""
    header = payload.get(HEADER_KEY) or payload.get(LEGACY_HEADER_KEY) or {}
    return header if isinstance(header, dict) else {}


def read_sidecar(path: Path) -> dict[str, Any]:
    """Read a sidecar, refusing a version this build does not understand."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name} is not a Resonand sidecar.")
    header = _header(payload)
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
    _grant_all(session, payload.get("shares"), library_id=None, audio_id=audio.id)
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


# --- The instance -----------------------------------------------------------


def manifest_for(
    session: Session,
    exported: list[Library],
    *,
    recordings: int,
    skipped_in_trash: int,
) -> dict[str, Any]:
    """The accounts, libraries and sharing behind an export.

    Identities only. Nothing here lets anybody sign in, which is the whole reason an export can
    be handed to somebody or left on a disk.
    """
    described: list[dict[str, Any]] = []
    accounts: dict[int, User] = {}
    for library in exported:
        owner = session.get(User, library.owner_id)
        if owner is not None:
            accounts[owner.id] = owner
        shares = _shares_on(session, library_id=library.id)
        for grantee in _grantees_of(session, library_id=library.id):
            accounts[grantee.id] = grantee
        described.append(
            {
                "uuid": library.uuid,
                "name": library.name,
                "description": library.description,
                "colour": library.colour,
                "is_personal": bool(library.is_personal),
                "owner": owner.email if owner else None,
                "shares": shares,
            }
        )
    return {
        "resonand": {
            "manifest_version": MANIFEST_VERSION,
            "exported_at": now_instant(),
            "version": __version__,
        },
        "recordings": recordings,
        # An export leaves the trash behind, so a count that does not match the archive has a
        # reason here rather than looking like a loss.
        "skipped_in_trash": skipped_in_trash,
        "users": [
            {
                "email": account.email,
                "display_name": account.display_name,
                "is_admin": bool(account.is_admin),
            }
            for account in sorted(accounts.values(), key=lambda one: one.email.lower())
        ],
        "libraries": described,
    }


def read_manifest(path: Path) -> dict[str, Any]:
    """Read an archive manifest, refusing a version this build does not understand."""
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"{path.name} is not a Resonand archive manifest.")
    header = _header(payload)
    version = header.get("manifest_version")
    if version != MANIFEST_VERSION:
        raise ValueError(
            f"{path.name} is manifest version {version}, and this build reads {MANIFEST_VERSION}."
        )
    return payload


def apply_manifest(session: Session, payload: dict[str, Any]) -> ManifestApplied:
    """Recreate the libraries and the sharing an export described.

    Accounts are deliberately not created. A library whose owner has no account here is refused
    by name rather than quietly reassigned to whoever ran the import, which would hand one
    person's recordings to another and look like it had worked.
    """
    resolved: dict[str, int] = {}
    missing: list[str] = []
    refused: list[str] = []
    for described in payload.get("libraries") or []:
        if not isinstance(described, dict):
            continue
        address = str(described.get("owner") or "")
        owner = users.find_by_email(session, address) if address else None
        if owner is None:
            refused.append(f"{described.get('name')} ({address or 'no owner named'})")
            if address:
                missing.append(address)
            continue
        library = _library_from_manifest(session, described, owner)
        resolved[str(described.get("uuid") or "")] = library.id
        _grant_all(
            session, described.get("shares"), library_id=library.id, audio_id=None, missing=missing
        )
    for account in payload.get("users") or []:
        address = str(account.get("email") or "") if isinstance(account, dict) else ""
        if address and users.find_by_email(session, address) is None:
            missing.append(address)
    session.flush()
    return ManifestApplied(
        libraries=resolved,
        missing_accounts=tuple(sorted({address.lower() for address in missing})),
        refused_libraries=tuple(refused),
    )


def _library_from_manifest(session: Session, described: dict[str, Any], owner: User) -> Library:
    """The library this entry means here: the one it names, the owner's own, or a new one."""
    uuid = str(described.get("uuid") or "")
    if uuid:
        existing = session.execute(select(Library).where(Library.uuid == uuid)).scalar_one_or_none()
        if existing is not None:
            return existing
    if described.get("is_personal"):
        try:
            # A personal library comes with the account, so the one here already has a uuid of
            # its own. Adopting the export's would rename a library that may already hold this
            # person's recordings.
            return users.personal_library(session, owner.id)
        except NotFoundError:
            pass
    library = libraries_repo.create_library(
        session,
        owner.id,
        name=str(described.get("name") or "Library"),
        description=described.get("description"),
        colour=_colour_of(described.get("colour")),
    )
    if uuid:
        library.uuid = uuid
        session.flush()
    return library


def _colour_of(value: object) -> str:
    """A library's colour, or the default if the export named one this build does not have."""
    try:
        return colours.Colour(str(value)).value
    except ValueError:
        return colours.DEFAULT.value


def _shares_on(
    session: Session, *, library_id: int | None = None, audio_id: int | None = None
) -> list[dict[str, Any]]:
    """Who a library or a recording is shared with, by address and level."""
    return [
        {"grantee": grantee.email, "level": int(share.level)}
        for share, grantee in session.execute(
            select(Share, User)
            .join(User, Share.grantee_id == User.id)
            .where(
                Share.library_id == library_id
                if library_id is not None
                else Share.audio_id == audio_id
            )
            .order_by(User.email)
        ).all()
    ]


def _grantees_of(session: Session, *, library_id: int) -> list[User]:
    return list(
        session.execute(
            select(User)
            .join(Share, Share.grantee_id == User.id)
            .where(Share.library_id == library_id)
        )
        .scalars()
        .all()
    )


def _grant_all(
    session: Session,
    described: object,
    *,
    library_id: int | None,
    audio_id: int | None,
    missing: list[str] | None = None,
) -> None:
    """Apply the grants an export described, skipping the ones with nobody to grant to."""
    if not isinstance(described, list):
        return
    owner_id = _grantor(session, library_id=library_id, audio_id=audio_id)
    if owner_id is None:
        return
    for entry in described:
        if not isinstance(entry, dict):
            continue
        address = str(entry.get("grantee") or "")
        grantee = users.find_by_email(session, address) if address else None
        if grantee is None:
            if address and missing is not None:
                missing.append(address)
            continue
        level = int(entry.get("level") or Level.READ)
        if level not in {int(one) for one in GRANTABLE} or grantee.id == owner_id:
            continue
        _grant(session, library_id, audio_id, grantee.id, level, granted_by=owner_id)


def _grantor(session: Session, *, library_id: int | None, audio_id: int | None) -> int | None:
    """Who a restored grant is recorded as coming from: the owner of the library it is in.

    The export does not carry who granted it, and the owner is the only account that certainly
    could have -- a grantee who could share onwards may not even have an account here.
    """
    if library_id is not None:
        library = session.get(Library, library_id)
        return library.owner_id if library else None
    audio = session.get(Audio, audio_id) if audio_id is not None else None
    library = session.get(Library, audio.library_id) if audio else None
    return library.owner_id if library else None


def _grant(
    session: Session,
    library_id: int | None,
    audio_id: int | None,
    grantee_id: int,
    level: int,
    *,
    granted_by: int,
) -> None:
    """Set one grant to this level, whether or not it is already here."""
    existing = session.execute(
        select(Share).where(
            Share.library_id == library_id,
            Share.audio_id == audio_id,
            Share.grantee_id == grantee_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.level = level
        return
    session.add(
        Share(
            library_id=library_id,
            audio_id=audio_id,
            grantee_id=grantee_id,
            level=level,
            granted_by=granted_by,
            created_at=now_instant(),
        )
    )
    session.flush()


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
