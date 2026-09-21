"""Reading a file's technical metadata with ``ffprobe`` (``ING-4``, the pure half).

Parsed defensively, because real files from real phones are not tidy: a duration on the container
but not on the stream, or the reverse; a video container whose first stream is the video; a
``.m4a`` that is really AAC in an MOV; fields simply absent. Every one of those is an ordinary
file somebody wants in their archive, so the parser's job is to get what it can and be honest
about the rest, not to insist on a well-formed answer.

``ffprobe`` returns technical metadata **only**. When a recording was made is a different
question and it is :mod:`resonand.media.recorded_at`'s (``ING-12``) -- without which every
``recorded_at`` in an imported archive of old voice notes is ``NULL``.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from resonand.core.errors import InvalidRequestError, ToolError
from resonand.core.processes import run_tool

PROBE_TIMEOUT_SECONDS = 60.0

_MIME_BY_FORMAT: dict[str, str] = {
    "mov,mp4,m4a,3gp,3g2,mj2": "audio/mp4",
    "mp3": "audio/mpeg",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
    "wav": "audio/wav",
    "matroska,webm": "audio/webm",
    "aac": "audio/aac",
    "amr": "audio/amr",
    "asf": "audio/x-ms-wma",
}


@dataclass(frozen=True, slots=True)
class Probe:
    """What ``ffprobe`` could establish about a file."""

    duration_ms: int | None
    sample_rate: int | None
    channels: int | None
    codec: str | None
    mime: str | None
    size_bytes: int
    has_video: bool
    """A video container is kept whole and its audio is derived; it is never shown as video."""

    format_tags: dict[str, str]
    """Container metadata, kept for ``ING-12`` to look for a creation time in."""


def probe(path: Path, *, timeout: float = PROBE_TIMEOUT_SECONDS) -> Probe:
    """Run ``ffprobe`` over a file and read what it says."""
    result = run_tool(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        timeout=timeout,
    )
    try:
        payload = json.loads(result.text)
    except json.JSONDecodeError as error:
        raise ToolError(f"ffprobe returned something unreadable for {path.name}") from error
    return parse_probe(payload, fallback_size=path.stat().st_size if path.exists() else 0)


def parse_probe(payload: dict[str, Any], *, fallback_size: int = 0) -> Probe:
    """Turn ``ffprobe``'s JSON into a :class:`Probe`, tolerating what it leaves out."""
    streams = payload.get("streams") or []
    container = payload.get("format") or {}
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if audio is None:
        raise InvalidRequestError(
            "This file has no audio track. Resonand is an audio archive; a video with no sound "
            "has nothing for it to keep."
        )
    duration = _duration_ms(audio.get("duration")) or _duration_ms(container.get("duration"))
    format_name = str(container.get("format_name") or "")
    return Probe(
        duration_ms=duration,
        sample_rate=_as_int(audio.get("sample_rate")),
        channels=_as_int(audio.get("channels")),
        codec=(str(audio["codec_name"]) if audio.get("codec_name") else None),
        mime=_MIME_BY_FORMAT.get(format_name),
        size_bytes=_as_int(container.get("size")) or fallback_size,
        has_video=any(
            s.get("codec_type") == "video" and s.get("disposition", {}).get("attached_pic") != 1
            for s in streams
        ),
        format_tags={str(k).lower(): str(v) for k, v in (container.get("tags") or {}).items()},
    )


def _duration_ms(value: object) -> int | None:
    """``ffprobe`` gives seconds as a string, and sometimes ``N/A``, or nothing at all."""
    seconds = _as_float(value)
    return round(seconds * 1000) if seconds is not None and seconds > 0 else None


def _as_float(value: object) -> float | None:
    if not isinstance(value, str | int | float):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _as_int(value: object) -> int | None:
    number = _as_float(value)
    return int(number) if number is not None else None
