"""Where a recording's bytes live (``ING-1``).

``storage/<uuid[0:2]>/<uuid>/original.<ext>``, with ``derived.opus`` beside it. The two-character
shard exists so that no single directory ever holds ten thousand entries, which is where
``ext4`` and every backup tool start to hurt.

**The original is written once and never rewritten.** That is principle 1, and it is the property
this module exists to make structural rather than aspirational: :func:`store_original` refuses a
path that already exists, and there is no function here that opens an original for writing.

Every write lands through a temporary name in the same directory, followed by ``fsync`` and
``rename``. A half-written file that a crash left behind under the final name would pass every
later check that only looks at whether a file is there -- and ``ING-13`` would only catch it
because the hash no longer matched, long after the upload that produced it.
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path

from sonarium.core.errors import ConflictError, InvalidRequestError, NotFoundError
from sonarium.core.formats import is_accepted, normalise_extension
from sonarium.core.ids import is_uuid
from sonarium.media.hashing import Digest, write_and_hash

ORIGINAL_STEM = "original"
DERIVED_NAME = "derived.opus"
SHARD_WIDTH = 2


def recording_dir(root: Path, uuid: str) -> Path:
    """The directory holding one recording's files."""
    if not is_uuid(uuid):
        raise InvalidRequestError(f"{uuid!r} is not a recording identifier.")
    return root / uuid[:SHARD_WIDTH] / uuid


def original_path(root: Path, uuid: str, extension: str) -> Path:
    """Where the intact original goes. The extension is kept so a download is what it was."""
    suffix = extension if extension.startswith(".") else f".{extension}"
    return recording_dir(root, uuid) / f"{ORIGINAL_STEM}{suffix.lower()}"


def derived_path(root: Path, uuid: str) -> Path:
    """Where the Opus derivative goes, next to the original it came from."""
    return recording_dir(root, uuid) / DERIVED_NAME


def relative(root: Path, path: Path) -> str:
    """The form stored in ``audio.storage_path``: relative, so the archive can be moved.

    An absolute path in the database would tie the archive to one machine's directory layout, and
    restoring a backup somewhere else is exactly when that is discovered.
    """
    return path.relative_to(root).as_posix()


def resolve(root: Path, stored: str) -> Path:
    """Turn a stored relative path back into a real one, refusing anything that escapes.

    The stored value comes from the archive's own database, so this is not defending against a
    hostile input so much as against a corrupted or hand-edited row pointing somewhere it should
    not -- which, on a delete, would be somebody else's file.
    """
    candidate = (root / stored).resolve()
    if not candidate.is_relative_to(root.resolve()):
        raise InvalidRequestError(f"{stored!r} points outside the archive.")
    return candidate


def find_original(root: Path, uuid: str) -> Path:
    """The original for a recording, whatever extension it happens to have."""
    directory = recording_dir(root, uuid)
    for candidate in sorted(directory.glob(f"{ORIGINAL_STEM}.*")):
        if candidate.is_file():
            return candidate
    raise NotFoundError("The original file for this recording is missing.")


def store_original(
    root: Path, uuid: str, chunks: Iterable[bytes], *, filename: str
) -> tuple[Path, Digest]:
    """Write an original and return where it went and what it hashes to.

    Refuses to overwrite. There is no legitimate path that writes an original twice, so a call
    that would is a bug worth stopping rather than a case worth handling.
    """
    if not is_accepted(filename):
        raise InvalidRequestError(
            f"{filename!r} is not a format this archive ingests. Audio files and video "
            "containers are accepted; the video's audio is what gets played."
        )
    destination = original_path(root, uuid, normalise_extension(filename))
    if destination.exists():
        raise ConflictError("This recording already has an original file.")
    digest = atomic_write(destination, chunks)
    return destination, digest


def atomic_write(destination: Path, chunks: Iterable[bytes]) -> Digest:
    """Write a stream so that the destination either does not exist or is complete.

    The temporary file is in the same directory, because ``rename`` is only atomic within one
    filesystem and ``/tmp`` is very often a different one.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = destination.with_name(f".{destination.name}.partial")
    try:
        digest = write_and_hash(chunks, staging)
        staging.replace(destination)
        _sync_directory(destination.parent)
    finally:
        staging.unlink(missing_ok=True)
    return digest


def replace_derived(root: Path, uuid: str, chunks: Iterable[bytes]) -> Path:
    """Write or rewrite the Opus derivative.

    Unlike the original, this one may be replaced: it is derived data, and being able to
    regenerate it is what makes changing the transcode settings an ordinary operation rather than
    a migration.
    """
    destination = derived_path(root, uuid)
    atomic_write(destination, chunks)
    return destination


def delete_recording(root: Path, uuid: str) -> int:
    """Remove everything belonging to one recording. Returns how many files went.

    Called by the retention purge (``INT-2``) and by an upload that failed after writing its
    bytes but before its row existed (``REV-1``) -- never by the trash. Nothing here is reachable
    from an ordinary delete: the trash sets ``deleted_at`` and touches no file at all, which is
    the whole reason a restore is instant.
    """
    directory = recording_dir(root, uuid)
    if not directory.exists():
        return 0
    removed = 0
    for path in sorted(directory.iterdir()):
        if path.is_file():
            path.unlink()
            removed += 1
    directory.rmdir()
    _prune_shard(directory.parent)
    return removed


def stored_files(root: Path) -> list[Path]:
    """Every original the archive holds, for ``ING-13`` to compare against the database."""
    return sorted(
        path
        for path in root.glob(f"*/*/{ORIGINAL_STEM}.*")
        if path.is_file() and len(path.parent.parent.name) == SHARD_WIDTH
    )


def _sync_directory(directory: Path) -> None:
    """Make the rename itself durable, not only the bytes it renamed."""
    handle = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(handle)
    finally:
        os.close(handle)


def _prune_shard(shard: Path) -> None:
    """Remove a shard directory once its last recording has gone."""
    if shard.is_dir() and not any(shard.iterdir()):
        shard.rmdir()
