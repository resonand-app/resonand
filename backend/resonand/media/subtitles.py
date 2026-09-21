"""Subtitles, derived from segments (``DEC-5``).

Never stored. Both formats are a rendering of the same timed segments, and keeping a copy of
either would create a second version of the transcript that can disagree with the first -- at
which point the export has to decide which one is true.

The two formats differ in exactly two ways, which is why they share everything below: SRT
separates seconds from milliseconds with a comma and numbers its cues from one; WebVTT uses a
full stop and wants a header.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

MILLISECONDS = 1000
SECONDS_PER_MINUTE = 60
MINUTES_PER_HOUR = 60


@dataclass(frozen=True, slots=True)
class Cue:
    """One line of subtitle: when it starts, when it ends, and what is said."""

    start_ms: int
    end_ms: int
    text: str


def to_vtt(cues: Sequence[Cue]) -> str:
    """WebVTT, which is what a browser's ``<track>`` element reads."""
    lines = ["WEBVTT", ""]
    for cue in cues:
        lines.append(f"{_stamp(cue.start_ms, '.')} --> {_stamp(cue.end_ms, '.')}")
        lines.append(cue.text.strip())
        lines.append("")
    return "\n".join(lines)


def to_srt(cues: Sequence[Cue]) -> str:
    """SubRip, which is what everything else reads."""
    lines: list[str] = []
    for index, cue in enumerate(cues, start=1):
        lines.append(str(index))
        lines.append(f"{_stamp(cue.start_ms, ',')} --> {_stamp(cue.end_ms, ',')}")
        lines.append(cue.text.strip())
        lines.append("")
    return "\n".join(lines)


def _stamp(milliseconds: int, decimal: str) -> str:
    """``HH:MM:SS.mmm``, always the same width so a player's parser does not have to think."""
    total = max(0, milliseconds)
    seconds, remainder = divmod(total, MILLISECONDS)
    minutes, second = divmod(seconds, SECONDS_PER_MINUTE)
    hour, minute = divmod(minutes, MINUTES_PER_HOUR)
    return f"{hour:02d}:{minute:02d}:{second:02d}{decimal}{remainder:03d}"
