"""The waveform format (``ING-5``, ``DEC-19``)."""

from __future__ import annotations

import struct
from pathlib import Path

import pytest
from sonarium.core.errors import InvalidRequestError
from sonarium.media import waveform

from tests.media.conftest import make_audio, needs_ffmpeg


def test_a_waveform_round_trips_exactly() -> None:
    original = waveform.Waveform(peaks_per_second=10, pairs=((-127, 127), (0, 0), (-3, 42)))
    assert waveform.decode(waveform.encode(original)) == original


def test_a_two_hour_recording_fits_in_the_format() -> None:
    """72,000 buckets. A 16-bit count would have overflowed after 109 minutes, which is the
    anchor use case and change. As JSON this would be about a megabyte per recording, read on
    every grid page."""
    made = waveform.Waveform(peaks_per_second=10, pairs=tuple((-50, 50) for _ in range(72_000)))
    assert len(waveform.encode(made)) == waveform.HEADER.size + 72_000 * 2


def test_a_version_this_build_does_not_know_is_refused_loudly() -> None:
    """Reading an unknown format as this one would draw a plausible picture of the wrong thing."""
    blob = bytearray(waveform.encode(waveform.Waveform(10, ((1, 2),))))
    blob[0] = 99
    with pytest.raises(InvalidRequestError, match="format version 99"):
        waveform.decode(bytes(blob))


def test_a_truncated_waveform_is_refused(tmp_path: Path) -> None:
    blob = waveform.encode(waveform.Waveform(10, ((1, 2), (3, 4))))
    with pytest.raises(InvalidRequestError, match="truncated"):
        waveform.decode(blob[:-1])


def test_something_that_is_not_a_waveform_is_refused() -> None:
    with pytest.raises(InvalidRequestError, match="too short"):
        waveform.decode(b"no")


def test_the_rate_is_stored_so_a_bucket_always_means_the_same_time() -> None:
    made = waveform.Waveform(peaks_per_second=25, pairs=tuple((0, 1) for _ in range(50)))
    decoded = waveform.decode(waveform.encode(made))
    assert decoded.peaks_per_second == 25
    assert decoded.duration_ms == 2000


def test_samples_reduce_to_the_expected_number_of_buckets() -> None:
    one_second = struct.pack(f"<{waveform.DECODE_SAMPLE_RATE}h", *([1000] * 8000))
    made = waveform.from_samples(one_second, peaks_per_second=10)
    assert len(made.pairs) == 10


def test_a_bucket_keeps_both_extremes_not_just_a_level() -> None:
    """A waveform drawn from one value per bucket loses what makes speech look like speech."""
    samples = struct.pack("<4h", -30000, 20000, -100, 100)
    made = waveform.from_samples(samples, peaks_per_second=1)
    assert len(made.pairs) == 1
    assert made.pairs[0][0] < 0 < made.pairs[0][1]


def test_silence_is_flat_and_loud_audio_is_not() -> None:
    quiet = waveform.from_samples(struct.pack("<8000h", *([0] * 8000)), peaks_per_second=1)
    loud = waveform.from_samples(
        struct.pack("<8000h", *([30000, -30000] * 4000)), peaks_per_second=1
    )
    assert quiet.pairs[0] == (0, 0)
    assert loud.pairs[0][1] > 100


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_real_file_produces_a_waveform_of_the_right_length(tmp_path: Path) -> None:
    made = waveform.compute(make_audio(tmp_path / "tone.wav", seconds=3.0), peaks_per_second=10)
    assert 28 <= len(made.pairs) <= 32, "about ten buckets a second for three seconds"
    # ffmpeg's sine filter is not full scale -- it peaks around an eighth of it.
    assert any(high > 5 for _, high in made.pairs), "a tone is not silence"
    assert all(low <= 0 <= high for low, high in made.pairs), "a tone swings both ways"
