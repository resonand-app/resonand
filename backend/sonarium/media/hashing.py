"""Streaming SHA-256, taken while the bytes are being written (``ING-3``, the pure half).

The hash comes out of the *same* pass that writes the file. An hours-long upload arrives once and
must not be walked a second time to be identified: on a cold archive that second walk is disk
bound, and it competes with the transcode of whatever arrived before it.

What the interface built on top of this must not imply: the match is over **byte-identical files
only**. A re-encoded copy of the same recording -- the same voice note exported again by the same
phone -- has a different hash and will not be caught, so the wording is always "the same file",
never "the same recording". The match also **includes trashed recordings** (``DEC-16``): a hit on
a deleted row offers to restore it, because excluding the trash is what lets a later restore
produce a real duplicate. Deciding any of that is a database query and does not live here.
"""

from __future__ import annotations

import hashlib
import os
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from pathlib import Path

HASH_NAME = "sha256"
"""The one algorithm the archive stores. ``audio.sha256`` is a column, not a negotiation."""

READ_CHUNK_BYTES = 1024 * 1024
"""Big enough that the syscall overhead disappears, small enough to be invisible in memory."""


@dataclass(frozen=True, slots=True)
class Digest:
    """What one pass over a stream established: its identity and its length."""

    sha256: str
    size_bytes: int


def read_in_chunks(path: Path, *, chunk_bytes: int = READ_CHUNK_BYTES) -> Iterator[bytes]:
    """Read a file as a sequence of blocks, so nothing ever holds a whole recording."""
    with path.open("rb") as handle:
        while True:
            block = handle.read(chunk_bytes)
            if not block:
                return
            yield block


def hash_chunks(chunks: Iterable[bytes]) -> Digest:
    """Digest a stream of blocks without keeping any of them."""
    digest = hashlib.new(HASH_NAME)
    size = 0
    for block in chunks:
        digest.update(block)
        size += len(block)
    return Digest(sha256=digest.hexdigest(), size_bytes=size)


def hash_file(path: Path, *, chunk_bytes: int = READ_CHUNK_BYTES) -> Digest:
    """Digest a file that is already on disk -- what ``ING-13``'s integrity check re-runs."""
    return hash_chunks(read_in_chunks(path, chunk_bytes=chunk_bytes))


def write_and_hash(chunks: Iterable[bytes], destination: Path) -> Digest:
    """Write a stream to ``destination`` and return the digest of what was written.

    The file is flushed and ``fsync``ed before this returns, so a caller that renames it into
    place afterwards is renaming bytes that are actually on the disk rather than bytes that a
    power cut can still take back.
    """
    digest = hashlib.new(HASH_NAME)
    size = 0
    with destination.open("wb") as handle:
        for block in chunks:
            handle.write(block)
            digest.update(block)
            size += len(block)
        handle.flush()
        os.fsync(handle.fileno())
    return Digest(sha256=digest.hexdigest(), size_bytes=size)
