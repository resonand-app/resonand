"""The Opus derivative (``ING-6``).

The original is kept byte for byte and is never what a browser plays. Opus is what it plays,
because it is the one codec every current browser decodes, it is very good at speech at low
bitrates, and the derivative is regenerable -- so choosing it commits nothing.

**Audio only, always.** A video container is accepted and kept whole (``DEC-17``), and the video
track is simply not carried into the derivative: the archive is for what was said, the picture is
not what anybody is coming back for, and it is never presented as a video player.
"""

from __future__ import annotations

from pathlib import Path

from sonarium.core.processes import run_tool

SPEECH_BITRATE = "48k"
"""Opus at 48 kbit/s mono is transparent enough for speech that nobody notices, and it makes an
hour of driving about 20 MB rather than 200. The original is untouched, so nothing is lost."""

DERIVED_SAMPLE_RATE = 48000
"""Opus works internally at 48 kHz; asking for anything else makes ffmpeg resample twice."""

TRANSCODE_TIMEOUT_SECONDS = 3600.0


def to_opus(source: Path, destination: Path, *, timeout: float = TRANSCODE_TIMEOUT_SECONDS) -> Path:
    """Produce the playback derivative, replacing any earlier one.

    Written through a temporary name in the same directory: a half-written derivative that a
    crash left under the final name would be served to somebody as a truncated recording, and it
    would look like data loss rather than like a failed transcode.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = destination.with_name(f".{destination.name}.partial")
    try:
        run_tool(
            [
                "ffmpeg",
                "-nostdin",
                "-v",
                "error",
                "-y",
                "-i",
                str(source),
                "-vn",
                "-map_metadata",
                "-1",
                "-ac",
                "1",
                "-ar",
                str(DERIVED_SAMPLE_RATE),
                "-c:a",
                "libopus",
                "-b:a",
                SPEECH_BITRATE,
                "-application",
                "voip",
                "-f",
                "opus",
                str(staging),
            ],
            timeout=timeout,
        )
        staging.replace(destination)
    finally:
        staging.unlink(missing_ok=True)
    return destination


def extract_part(
    source: Path,
    destination: Path,
    *,
    start_ms: int,
    duration_ms: int,
    timeout: float = TRANSCODE_TIMEOUT_SECONDS,
) -> Path:
    """Cut one span out of a recording, as Opus.

    Used by ``JOB-13`` to submit a long recording in parts. The seek goes **before** the input so
    ffmpeg jumps rather than decoding everything up to the cut -- on the last part of a
    three-hour file, that is the difference between a second and several minutes.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
    run_tool(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "error",
            "-y",
            "-ss",
            f"{start_ms / 1000:.3f}",
            "-t",
            f"{duration_ms / 1000:.3f}",
            "-i",
            str(source),
            "-vn",
            "-map_metadata",
            "-1",
            "-ac",
            "1",
            "-ar",
            str(DERIVED_SAMPLE_RATE),
            "-c:a",
            "libopus",
            "-b:a",
            SPEECH_BITRATE,
            "-f",
            "opus",
            str(destination),
        ],
        timeout=timeout,
    )
    return destination
