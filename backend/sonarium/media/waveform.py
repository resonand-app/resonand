"""The waveform (``ING-5``, ``DEC-19``).

The product's signature visual element and, functionally, its thumbnail: it is what makes a list
of eight hundred recordings look like eight hundred *recordings* rather than eight hundred rows.

**Mono ``int8`` min/max pairs at a fixed rate, behind a one-byte format version.** Each part of
that earns its place:

* *Mono* -- the picture is a shape, not a mix. Two channels would double the size for a
  difference nobody can see at 40 pixels tall.
* *min/max pairs* rather than a single amplitude, because a waveform drawn from one value per
  bucket loses the asymmetry that makes speech look like speech.
* *``int8``* -- 256 levels is more than a bar chart can show. Ten peaks a second of stereo
  ``float32`` would be 80 times larger for a picture that renders identically.
* *A fixed rate* so that two recordings are comparable, and a bucket always means the same
  amount of time.
* *A version byte* so that recomputing stays cheap and safe. Peaks are derived data; the byte is
  what lets the format change without anybody having to guess what an old blob meant.

Stored as a compact ``BLOB``, never as JSON: a two-hour recording is 72,000 buckets, which is
144 KB packed and roughly a megabyte of JSON, per recording, read on every grid page.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from pathlib import Path

from sonarium.core.errors import InvalidRequestError
from sonarium.core.processes import run_tool

FORMAT_VERSION = 1
HEADER = struct.Struct("<BBI")
"""version, peaks per second, bucket count. Little-endian and fixed, so it reads the same
everywhere.

The count is 32-bit and not 16-bit, which is not an abundance of caution: at ten buckets a
second a 16-bit count overflows after 109 minutes, and a forty-minute interview is the anchor
use case. It is stored at all -- rather than derived from the blob's length -- so that a
truncated blob is caught rather than drawn."""

DECODE_SAMPLE_RATE = 8000
"""Peaks do not need fidelity, they need shape. Decoding at 8 kHz mono is several times faster
than at 48 kHz and produces the same picture."""

MAX_PEAK = 127
DEFAULT_PEAKS_PER_SECOND = 10
WAVEFORM_TIMEOUT_SECONDS = 900.0


@dataclass(frozen=True, slots=True)
class Waveform:
    """A decoded waveform: one ``(minimum, maximum)`` pair per bucket."""

    peaks_per_second: int
    pairs: tuple[tuple[int, int], ...]

    @property
    def duration_ms(self) -> int:
        """How much time the picture covers, which is what the player scrubs across."""
        return round(len(self.pairs) * 1000 / self.peaks_per_second)


def encode(waveform: Waveform) -> bytes:
    """Pack a waveform into the stored form."""
    if not 1 <= waveform.peaks_per_second <= MAX_PEAK:
        raise InvalidRequestError("A waveform's rate has to fit in a byte.")
    body = bytearray()
    for low, high in waveform.pairs:
        body.append(_clamp(low) & 0xFF)
        body.append(_clamp(high) & 0xFF)
    return HEADER.pack(FORMAT_VERSION, waveform.peaks_per_second, len(waveform.pairs)) + bytes(body)


def decode(blob: bytes) -> Waveform:
    """Unpack a stored waveform, refusing a version this code does not know.

    Refusing loudly is the point of the version byte. Reading an unknown format as though it were
    this one would produce a plausible-looking picture of the wrong thing, which nobody would ever
    report as a bug.
    """
    if len(blob) < HEADER.size:
        raise InvalidRequestError("This waveform is too short to be one.")
    version, peaks_per_second, count = HEADER.unpack_from(blob)
    if version != FORMAT_VERSION:
        raise InvalidRequestError(
            f"This waveform is in format version {version} and this build only reads "
            f"{FORMAT_VERSION}. Peaks are derived data: recompute them."
        )
    expected = HEADER.size + count * 2
    if len(blob) != expected:
        raise InvalidRequestError("This waveform is truncated.")
    values = struct.unpack_from(f"<{count * 2}b", blob, HEADER.size)
    return Waveform(
        peaks_per_second=peaks_per_second,
        pairs=tuple(zip(values[0::2], values[1::2], strict=True)),
    )


def compute(
    path: Path,
    *,
    peaks_per_second: int = DEFAULT_PEAKS_PER_SECOND,
    timeout: float = WAVEFORM_TIMEOUT_SECONDS,
) -> Waveform:
    """Derive a waveform from a file.

    Decoded through a pipe and reduced bucket by bucket, so memory does not scale with duration:
    a three-hour interview is the normal case here, not the extreme one.
    """
    raw = run_tool(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-i",
            str(path),
            "-vn",
            "-ac",
            "1",
            "-ar",
            str(DECODE_SAMPLE_RATE),
            "-f",
            "s16le",
            "-",
        ],
        timeout=timeout,
    ).stdout
    return from_samples(raw, peaks_per_second=peaks_per_second)


def from_samples(raw: bytes, *, peaks_per_second: int = DEFAULT_PEAKS_PER_SECOND) -> Waveform:
    """Reduce signed 16-bit mono samples to buckets."""
    samples_per_bucket = max(1, DECODE_SAMPLE_RATE // peaks_per_second)
    total = len(raw) // 2
    pairs: list[tuple[int, int]] = []
    for start in range(0, total, samples_per_bucket):
        count = min(samples_per_bucket, total - start)
        bucket = struct.unpack_from(f"<{count}h", raw, start * 2)
        pairs.append((_to_peak(min(bucket)), _to_peak(max(bucket))))
    return Waveform(peaks_per_second=peaks_per_second, pairs=tuple(pairs))


def _to_peak(sample: int) -> int:
    """Scale a 16-bit sample into the stored byte range."""
    return _clamp(round(sample * MAX_PEAK / 32768))


def _clamp(value: int) -> int:
    return max(-MAX_PEAK, min(MAX_PEAK, value))
