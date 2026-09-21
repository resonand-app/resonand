"""The Opus derivative (``ING-6``)."""

from __future__ import annotations

from pathlib import Path

import pytest
from resonand.core.errors import ToolError
from resonand.media.probe import probe
from resonand.media.transcode import extract_part, to_opus

from tests.media.conftest import make_audio, make_video, needs_ffmpeg

pytestmark = [needs_ffmpeg, pytest.mark.ffmpeg]


def test_a_recording_becomes_opus(tmp_path: Path) -> None:
    source = make_audio(tmp_path / "note.wav", seconds=2.0)
    made = to_opus(source, tmp_path / "derived.opus")
    assert probe(made).codec == "opus"


def test_the_original_is_untouched_by_transcoding(tmp_path: Path) -> None:
    """Principle 1. The derivative is a second file, never a rewrite of the first."""
    source = make_audio(tmp_path / "note.wav", seconds=2.0)
    before = source.read_bytes()
    to_opus(source, tmp_path / "derived.opus")
    assert source.read_bytes() == before


def test_a_video_container_yields_audio_only(tmp_path: Path) -> None:
    """It is never presented as a video player, so the derivative carries no picture."""
    source = make_video(tmp_path / "grandmother.mp4", seconds=2.0)
    made = to_opus(source, tmp_path / "derived.opus")
    assert probe(made).has_video is False


def test_the_derivative_can_be_regenerated(tmp_path: Path) -> None:
    """Derived data. Being able to redo it is what makes changing the settings ordinary."""
    source = make_audio(tmp_path / "note.wav", seconds=2.0)
    destination = tmp_path / "derived.opus"
    to_opus(source, destination)
    to_opus(source, destination)
    assert destination.exists()


def test_a_failed_transcode_leaves_no_truncated_file(tmp_path: Path) -> None:
    """A half derivative under the final name would be served as a truncated recording."""
    destination = tmp_path / "derived.opus"
    with pytest.raises(ToolError):
        to_opus(tmp_path / "not-a-file.wav", destination)
    assert not destination.exists()
    assert list(tmp_path.glob(".*partial")) == []


def test_a_part_is_cut_at_the_right_offset(tmp_path: Path) -> None:
    """JOB-13 submits long recordings in parts, and the parts have to be the right ones."""
    source = make_audio(tmp_path / "long.wav", seconds=6.0)
    part = extract_part(source, tmp_path / "part.opus", start_ms=2_000, duration_ms=2_000)
    duration = probe(part).duration_ms or 0
    assert 1_800 <= duration <= 2_200
