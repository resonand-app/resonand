"""Splitting a long recording, and putting the timestamps back together (``JOB-13``).

**The highest-risk piece in the plan, and the one most likely to need a second attempt.** The
anchor use case is a forty-minute interview and the daily one is an hour of driving; the hosted
OpenAI-compatible path caps a request at 25 MB and local servers impose their own memory and
timeout ceilings. Without this, the first version fails on exactly the recordings that motivated
the project.

The arithmetic is separated from the I/O deliberately, because the arithmetic is the part that has
to be provably right. :func:`plan_parts` and :func:`restitch` are pure and can be tested
exhaustively without touching a file; :func:`detect_silences` and the extraction around them are
the part that needs ffmpeg.

**What goes wrong if the offsets are dropped** is worth stating, because it is invisible: the
transcript reads perfectly, every word is there, and every click in the last hour seeks to the
wrong place. Nobody reports that as a transcription bug.

The seam rule: parts overlap, and a segment is kept by whichever part's span contains its
**midpoint**. Every moment of audio is inside exactly one part's span, so nothing is emitted twice
and nothing falls down the gap -- which a rule based on comparing text could not promise, since a
speaker really can say the same short phrase twice either side of a cut.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

from sonarium.core.processes import run_tool
from sonarium.transcription.capabilities import Capabilities
from sonarium.transcription.contract import TranscriptSegment

SILENCE_NOISE_DB = -30.0
MIN_SILENCE_MS = 400
SILENCE_TIMEOUT_SECONDS = 1800.0

DEFAULT_MAX_PART_MS = 600_000
DEFAULT_OVERLAP_MS = 3_000
MIN_PART_MS = 5_000
"""Below this a part is not worth submitting on its own; the planner absorbs it into its
neighbour rather than sending a two-second request that a provider may reject outright."""

_SILENCE_START = re.compile(r"silence_start:\s*(-?[\d.]+)")
_SILENCE_END = re.compile(r"silence_end:\s*(-?[\d.]+)")


@dataclass(frozen=True, slots=True)
class Silence:
    """A stretch with nothing in it, which is where a cut belongs."""

    start_ms: int
    end_ms: int

    @property
    def middle_ms(self) -> int:
        """Cutting in the middle of a pause leaves room on both sides of the seam."""
        return (self.start_ms + self.end_ms) // 2


@dataclass(frozen=True, slots=True)
class Part:
    """One submission's worth of audio, and where it sits in the recording."""

    index: int
    start_ms: int
    duration_ms: int

    @property
    def end_ms(self) -> int:
        return self.start_ms + self.duration_ms


@dataclass(frozen=True, slots=True)
class Plan:
    """How a recording will be submitted."""

    parts: tuple[Part, ...]
    overlap_ms: int

    @property
    def is_single(self) -> bool:
        """A recording under the ceiling is one part with no seams, and must stay that way."""
        return len(self.parts) == 1


def max_part_ms_for(max_bytes: int, *, bitrate_bps: int = 48_000) -> int:
    """How much audio fits in one request at the derivative's bitrate.

    The parts are submitted as Opus at the same bitrate as the playback derivative, so this is
    arithmetic rather than a guess. A tenth is left as headroom for the container and the
    multipart envelope, which are small but not nothing.
    """
    seconds = (max_bytes * 8) / bitrate_bps
    return max(MIN_PART_MS, int(seconds * 900))


def submission_ceiling(
    capabilities: Capabilities, *, configured_max_bytes: int, configured_max_part_ms: int
) -> int:
    """The longest part the configured engine will accept (``TRX-3``).

    **Each configured value is a fallback for the declaration it stands in for**, and is replaced
    rather than combined with it. Both settings describe the engine rather than a preference --
    ``transcription_request_max_bytes`` is there because "the hosted path caps a request here" and
    ``transcription_max_part_seconds`` because ten minutes "keeps a local server inside its memory
    and timeout ceilings" -- so an engine that states its own limits has answered the question they
    were guessing at, and keeping the guess as a second ceiling would mean a five-gigabyte engine
    still cut a forty-minute interview into four parts for nothing.

    Where an engine declares neither, both configured values apply exactly as they did before.
    """
    from_bytes = max_part_ms_for(capabilities.max_request_bytes or configured_max_bytes)
    from_duration = capabilities.max_duration_ms or configured_max_part_ms
    return min(from_bytes, from_duration)


def plan_parts(
    duration_ms: int,
    *,
    silences: Sequence[Silence] = (),
    max_part_ms: int = DEFAULT_MAX_PART_MS,
    overlap_ms: int = DEFAULT_OVERLAP_MS,
) -> Plan:
    """Decide where to cut.

    Cuts land in silence when there is any near the target boundary, and at the ceiling when there
    is not -- a continuous forty minutes of speech is not hypothetical, and a planner that
    insisted on a pause would either never cut it or cut it somewhere absurd.
    """
    if duration_ms <= max_part_ms:
        return Plan(parts=(Part(index=0, start_ms=0, duration_ms=duration_ms),), overlap_ms=0)

    boundaries: list[int] = []
    position = 0
    while duration_ms - position > max_part_ms:
        target = position + max_part_ms
        cut = _cut_near(target, silences=silences, earliest=position + MIN_PART_MS, latest=target)
        if cut <= position:
            cut = target
        boundaries.append(cut)
        position = cut

    parts: list[Part] = []
    starts = [0, *boundaries]
    ends = [*boundaries, duration_ms]
    for index, (start, end) in enumerate(zip(starts, ends, strict=True)):
        overlapped_start = max(0, start - overlap_ms) if index else 0
        parts.append(
            Part(index=index, start_ms=overlapped_start, duration_ms=end - overlapped_start)
        )
    return Plan(parts=tuple(parts), overlap_ms=overlap_ms)


def seams(plan: Plan) -> tuple[int, ...]:
    """The instants that divide the recording between consecutive parts.

    Each seam is the middle of an overlap, so both parts had a run-up to it and neither was asked
    to transcribe a word that starts at its very first sample.
    """
    if plan.is_single:
        return ()
    return tuple(
        (plan.parts[index + 1].start_ms + plan.parts[index].end_ms) // 2
        for index in range(len(plan.parts) - 1)
    )


def restitch(
    plan: Plan, results: Sequence[Sequence[TranscriptSegment]]
) -> tuple[TranscriptSegment, ...]:
    """Put the parts back into one timeline.

    Every returned segment is offset by its part's start -- this is the whole task -- and the
    overlap is removed by the seam rule at the top of this module.
    """
    if len(results) != len(plan.parts):
        raise ValueError(
            f"{len(results)} results for {len(plan.parts)} parts: the plan and the submissions "
            "have gone out of step, and stitching them would silently misplace speech."
        )
    cuts = seams(plan)
    stitched: list[TranscriptSegment] = []
    for part, segments in zip(plan.parts, results, strict=True):
        lower = cuts[part.index - 1] if part.index else 0
        upper = cuts[part.index] if part.index < len(cuts) else None
        for segment in segments:
            shifted = segment.shifted(part.start_ms)
            middle = (shifted.start_ms + shifted.end_ms) // 2
            if middle < lower:
                continue
            if upper is not None and middle >= upper:
                continue
            stitched.append(shifted)
    stitched.sort(key=lambda segment: (segment.start_ms, segment.end_ms))
    return tuple(stitched)


def detect_silences(
    path: Path,
    *,
    noise_db: float = SILENCE_NOISE_DB,
    min_silence_ms: int = MIN_SILENCE_MS,
    timeout: float = SILENCE_TIMEOUT_SECONDS,
) -> tuple[Silence, ...]:
    """Find the pauses, so the cuts can land in them.

    ffmpeg writes ``silencedetect``'s findings to standard error, interleaved with everything else
    it has to say, which is why this parses that stream rather than reading a clean report.
    """
    result = run_tool(
        [
            "ffmpeg",
            "-nostdin",
            "-v",
            "info",
            "-i",
            str(path),
            "-vn",
            "-af",
            f"silencedetect=noise={noise_db}dB:d={min_silence_ms / 1000:.3f}",
            "-f",
            "null",
            "-",
        ],
        timeout=timeout,
    )
    return parse_silences(result.error_text)


def parse_silences(ffmpeg_output: str) -> tuple[Silence, ...]:
    """Read the ``silence_start`` / ``silence_end`` pairs out of ffmpeg's chatter."""
    found: list[Silence] = []
    pending: int | None = None
    for line in ffmpeg_output.splitlines():
        start = _SILENCE_START.search(line)
        if start:
            pending = max(0, round(float(start.group(1)) * 1000))
            continue
        end = _SILENCE_END.search(line)
        if end and pending is not None:
            found.append(Silence(start_ms=pending, end_ms=round(float(end.group(1)) * 1000)))
            pending = None
    return tuple(found)


def _cut_near(target: int, *, silences: Sequence[Silence], earliest: int, latest: int) -> int:
    """The best cut at or before ``latest``: the nearest silence, or the target itself."""
    usable = [silence.middle_ms for silence in silences if earliest <= silence.middle_ms <= latest]
    if not usable:
        return target
    return min(usable, key=lambda position: abs(position - target))
