"""Audio fixtures, generated with ffmpeg rather than committed as binaries."""

from __future__ import annotations

import shutil
from collections.abc import Callable
from pathlib import Path

import pytest
from resonand.core.processes import run_tool

HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None

needs_ffmpeg = pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg and ffprobe are not installed")


def make_audio(path: Path, *, seconds: float = 2.0, frequency: int = 440) -> Path:
    """A short tone in whatever format the extension asks for."""
    path.parent.mkdir(parents=True, exist_ok=True)
    run_tool(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency={frequency}:duration={seconds}",
            str(path),
        ],
        timeout=60,
    )
    return path


def make_video(path: Path, *, seconds: float = 2.0) -> Path:
    """A video container with a sound track -- the mp4 with your grandmother in it."""
    path.parent.mkdir(parents=True, exist_ok=True)
    run_tool(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=black:s=64x64:d={seconds}",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency=440:duration={seconds}",
            "-shortest",
            str(path),
        ],
        timeout=60,
    )
    return path


@pytest.fixture
def audio_factory(tmp_path: Path) -> Callable[..., Path]:
    def make(name: str = "note.m4a", *, seconds: float = 2.0) -> Path:
        return make_audio(tmp_path / name, seconds=seconds)

    return make
