"""The waveform format (``ING-5``, ``DEC-19``, ``ING-14``)."""

from __future__ import annotations

import struct
from pathlib import Path

import pytest
from sonarium.core.errors import InvalidRequestError
from sonarium.media import waveform

from tests.media.conftest import make_audio, needs_ffmpeg


def test_a_waveform_round_trips_exactly() -> None:
    original = waveform.Waveform(duration_ms=300, pairs=((-127, 127), (0, 0), (-3, 42)))
    assert waveform.decode(waveform.encode(original)) == original


def test_a_two_hour_recording_fits_in_the_format() -> None:
    """72,000 buckets. A 16-bit count would have overflowed after 109 minutes, which is the
    anchor use case and change. As JSON this would be about a megabyte per recording, read on
    every grid page."""
    made = waveform.Waveform(duration_ms=7_200_000, pairs=tuple((-50, 50) for _ in range(72_000)))
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


def test_the_duration_is_stored_so_a_bucket_always_means_the_same_time() -> None:
    """The duration is what a bucket is measured against, and the quantity that stays true when
    the pairs are reduced for a smaller drawing. The rate is derived from it."""
    made = waveform.Waveform(duration_ms=2000, pairs=tuple((0, 1) for _ in range(50)))
    decoded = waveform.decode(waveform.encode(made))
    assert decoded.duration_ms == 2000
    assert decoded.peaks_per_second == 25


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


# --- Reducing for a smaller drawing (``ING-14``) --------------------------


def _ramp(count: int, duration_ms: int = 10_000) -> waveform.Waveform:
    """A waveform whose pairs all differ, so a reduction that lost one would show."""
    return waveform.Waveform(
        duration_ms=duration_ms,
        pairs=tuple((-(index % 100) - 1, (index % 100) + 1) for index in range(count)),
    )


def test_reducing_keeps_the_duration_and_changes_the_count() -> None:
    """The reason the format stores a duration: 200 pairs over 48 minutes is 0.07 peaks a second,
    which version 1 could not have written at all."""
    reduced = waveform.resample(_ramp(28_800, duration_ms=2_880_000), 200)
    assert len(reduced.pairs) == 200
    assert reduced.duration_ms == 2_880_000
    assert waveform.decode(waveform.encode(reduced)) == reduced


def test_a_reduction_of_a_reduction_is_the_same_shape() -> None:
    """``ING-14``'s test. Going through an intermediate size must not drift from going straight
    there, or the same recording draws differently depending on what was cached."""
    original = _ramp(800)
    assert waveform.resample(waveform.resample(original, 400), 200) == waveform.resample(
        original, 200
    )


def test_a_reduced_bucket_keeps_the_extremes_of_what_it_covers() -> None:
    """Averaging would flatten a shout in a quiet room into the quiet room."""
    pairs = ((-1, 1), (-120, 120), (-1, 1), (-1, 1))
    reduced = waveform.resample(waveform.Waveform(duration_ms=4000, pairs=pairs), 2)
    assert reduced.pairs[0] == (-120, 120)


def test_asking_for_more_than_there_are_returns_what_there_is() -> None:
    """Interpolating up would invent detail the recording never had."""
    original = _ramp(50)
    assert waveform.resample(original, 500) is original
    assert waveform.resample(original, 50) is original


def test_asking_for_no_buckets_is_refused() -> None:
    with pytest.raises(InvalidRequestError, match="at least one bucket"):
        waveform.resample(_ramp(50), 0)


def test_silence_stays_silent_when_reduced() -> None:
    """A row of dots is a true picture of a quiet passage; a flat line hides that it was drawn."""
    quiet = waveform.Waveform(duration_ms=5000, pairs=tuple((0, 0) for _ in range(500)))
    assert set(waveform.resample(quiet, 20).pairs) == {(0, 0)}


# --- Version 1, still readable --------------------------------------------


def test_a_version_one_blob_still_reads() -> None:
    """Peaks are derived data, but there is nothing to guess here: a rate and a count give a
    duration exactly, so no existing instance has to recompute every recording it holds."""
    old = waveform.HEADER_V1.pack(1, 10, 3) + struct.pack("<6b", -1, 1, -2, 2, -3, 3)
    decoded = waveform.decode(old)
    assert decoded.duration_ms == 300
    assert decoded.pairs == ((-1, 1), (-2, 2), (-3, 3))


def test_a_version_one_blob_is_rewritten_as_version_two() -> None:
    """Reading both and writing one is what keeps the migration to nothing at all."""
    old = waveform.HEADER_V1.pack(1, 25, 50) + struct.pack("<100b", *([0, 1] * 50))
    rewritten = waveform.encode(waveform.decode(old))
    assert rewritten[0] == waveform.FORMAT_VERSION
    assert waveform.decode(rewritten).duration_ms == 2000


def test_a_truncated_version_one_blob_is_still_refused() -> None:
    old = waveform.HEADER_V1.pack(1, 10, 3) + struct.pack("<4b", -1, 1, -2, 2)
    with pytest.raises(InvalidRequestError, match="truncated"):
        waveform.decode(old)
