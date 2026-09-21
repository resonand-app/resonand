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

from resonand.core.errors import InvalidRequestError
from resonand.core.processes import run_tool

FORMAT_VERSION = 2
HEADER = struct.Struct("<BII")
"""version, duration in milliseconds, bucket count. Little-endian and fixed, so it reads the same
everywhere.

**Version 1 stored peaks per second instead of a duration, in one byte** (``ING-5``), which was
right while a blob was only ever written at one fixed rate. ``ING-14`` serves the same recording
at whatever bucket count a drawing needs, and a 48-minute recording reduced to 200 pairs is 0.07
peaks per second -- not a byte, not even an integer. Duration is the quantity that survives
resampling; a rate is derived from it and the count.

The count is 32-bit and not 16-bit, which is not an abundance of caution: at ten buckets a
second a 16-bit count overflows after 109 minutes, and a forty-minute interview is the anchor
use case. It is stored at all -- rather than derived from the blob's length -- so that a
truncated blob is caught rather than drawn."""

HEADER_V1 = struct.Struct("<BBI")
"""Version 1: version, peaks per second, bucket count. Still read, never written.

Peaks are derived data and the module docstring says to recompute rather than guess, but there is
nothing to guess here -- a rate and a count give a duration exactly. Reading it costs four lines
and saves every existing instance a full re-derivation of every recording it holds."""

DECODE_SAMPLE_RATE = 8000
"""Peaks do not need fidelity, they need shape. Decoding at 8 kHz mono is several times faster
than at 48 kHz and produces the same picture."""

MAX_PEAK = 127
DEFAULT_PEAKS_PER_SECOND = 10
WAVEFORM_TIMEOUT_SECONDS = 900.0


@dataclass(frozen=True, slots=True)
class Waveform:
    """A decoded waveform: one ``(minimum, maximum)`` pair per bucket, over a known duration."""

    duration_ms: int
    """How much time the picture covers, which is what the player scrubs across. Stored rather
    than derived, because it is what stays true when the pairs are reduced for a smaller drawing."""

    pairs: tuple[tuple[int, int], ...]

    @property
    def peaks_per_second(self) -> float:
        """How dense this particular drawing is. Derived, and not necessarily a whole number
        once it has been resampled for a twenty-pixel row."""
        if not self.duration_ms:
            return 0.0
        return len(self.pairs) * 1000 / self.duration_ms


def encode(waveform: Waveform) -> bytes:
    """Pack a waveform into the stored form, always at the current version."""
    if waveform.duration_ms < 0:
        raise InvalidRequestError("A waveform cannot cover a negative amount of time.")
    body = bytearray()
    for low, high in waveform.pairs:
        body.append(_clamp(low) & 0xFF)
        body.append(_clamp(high) & 0xFF)
    return HEADER.pack(FORMAT_VERSION, waveform.duration_ms, len(waveform.pairs)) + bytes(body)


def decode(blob: bytes) -> Waveform:
    """Unpack a stored waveform, refusing a version this code does not know.

    Refusing loudly is the point of the version byte. Reading an unknown format as though it were
    this one would produce a plausible-looking picture of the wrong thing, which nobody would ever
    report as a bug. Version 1 is not unknown, though -- its rate and count give a duration
    exactly -- so it is read rather than refused, and nothing already stored has to be recomputed.
    """
    # Length before version: something that is not a waveform at all should be told so, rather
    # than have its first byte read as a format number and reported as an unknown one.
    if len(blob) < HEADER_V1.size:
        raise InvalidRequestError("This waveform is too short to be one.")
    version = blob[0]
    if version == 1:
        return _decode_v1(blob)
    if version != FORMAT_VERSION:
        raise InvalidRequestError(
            f"This waveform is in format version {version} and this build only reads "
            f"1 and {FORMAT_VERSION}. Peaks are derived data: recompute them."
        )
    if len(blob) < HEADER.size:
        raise InvalidRequestError("This waveform is too short to be one.")
    _, duration_ms, count = HEADER.unpack_from(blob)
    return Waveform(duration_ms=duration_ms, pairs=_unpack_pairs(blob, HEADER.size, count))


def _decode_v1(blob: bytes) -> Waveform:
    if len(blob) < HEADER_V1.size:
        raise InvalidRequestError("This waveform is too short to be one.")
    _, peaks_per_second, count = HEADER_V1.unpack_from(blob)
    if peaks_per_second < 1:
        raise InvalidRequestError("This waveform claims a rate of nothing per second.")
    return Waveform(
        duration_ms=round(count * 1000 / peaks_per_second),
        pairs=_unpack_pairs(blob, HEADER_V1.size, count),
    )


def _unpack_pairs(blob: bytes, offset: int, count: int) -> tuple[tuple[int, int], ...]:
    if len(blob) != offset + count * 2:
        raise InvalidRequestError("This waveform is truncated.")
    values = struct.unpack_from(f"<{count * 2}b", blob, offset)
    return tuple(zip(values[0::2], values[1::2], strict=True))


def resample(waveform: Waveform, buckets: int) -> Waveform:
    """Reduce a waveform to ``buckets`` pairs, keeping its shape and its duration (``ING-14``).

    A bucket takes the lowest low and the highest high of the pairs it covers, which is what
    keeps a transient visible after reduction -- averaging would flatten a shout in a quiet room
    into the quiet room.

    **Asking for more buckets than there are returns the waveform unchanged.** Interpolating up
    would invent detail the recording never had, and a drawing that shows more than was measured
    is the one thing this file's version byte exists to prevent somebody doing by accident.
    """
    if buckets < 1:
        raise InvalidRequestError("A waveform needs at least one bucket.")
    total = len(waveform.pairs)
    if total <= buckets:
        return waveform
    reduced: list[tuple[int, int]] = []
    for index in range(buckets):
        start = index * total // buckets
        end = max(start + 1, (index + 1) * total // buckets)
        window = waveform.pairs[start:end]
        reduced.append((min(low for low, _ in window), max(high for _, high in window)))
    return Waveform(duration_ms=waveform.duration_ms, pairs=tuple(reduced))


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
    """Reduce signed 16-bit mono samples to buckets.

    ``peaks_per_second`` is the knob that decides how many buckets to make; the duration comes
    from how many samples there actually were, which is the honest source for it.
    """
    samples_per_bucket = max(1, DECODE_SAMPLE_RATE // peaks_per_second)
    total = len(raw) // 2
    pairs: list[tuple[int, int]] = []
    for start in range(0, total, samples_per_bucket):
        count = min(samples_per_bucket, total - start)
        bucket = struct.unpack_from(f"<{count}h", raw, start * 2)
        pairs.append((_to_peak(min(bucket)), _to_peak(max(bucket))))
    return Waveform(
        duration_ms=round(total * 1000 / DECODE_SAMPLE_RATE),
        pairs=tuple(pairs),
    )


def _to_peak(sample: int) -> int:
    """Scale a 16-bit sample into the stored byte range."""
    return _clamp(round(sample * MAX_PEAK / 32768))


def _clamp(value: int) -> int:
    return max(-MAX_PEAK, min(MAX_PEAK, value))
