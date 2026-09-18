"""Asking an engine what it can do, before any recording is sent to it (``TRX-1``).

**"OpenAI-compatible" is a URL shape, not a capability.** The model behind that URL decides whether
anything timed comes back, and the most likely thing an operator does -- point the base URL at a
hosted endpoint and set the model to the one that vendor's own documentation recommends -- reaches
a model that supports ``response_format=json`` and not ``verbose_json``. The archive stores timed
segments and nothing else, so that configuration cannot work; today it fails at the first real
transcription, after the recording has been uploaded and paid for.

This asks the same question with three seconds of audio generated on the spot, and answers it in a
sentence before anything of anybody's leaves the instance.

**What a tone can and cannot establish.** Synthetic audio has no speech in it, so an engine may
legitimately return no segments for it -- which means *produced segments* is not the question worth
asking. The question worth asking is whether the engine **accepts the request and answers in the
shape that carries segments at all**, and that is answerable without a word being spoken. Pass real
audio with ``--audio`` and the rest follows: how coarse the segments are, whether speakers are
named, and whether the timings line up with a duration we know exactly.

**What it deliberately does not report is the raw time unit.** A provider normalises to
milliseconds behind the contract, so by the time a result is in hand the question has been answered
and the answer is invisible. What is checked instead is the property that matters -- that the
timings came back inside audio whose length we chose ourselves -- which tests the normalisation
rather than repeating it.

Nothing here writes to the database or to configuration. It returns a value, so that whatever
holds configuration later (``TRX-15``) can store the answer against an engine without this module
knowing where that is.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path

from sonarium.core.errors import ProviderError, ProviderUnreachableError
from sonarium.core.processes import run_tool
from sonarium.transcription.capabilities import Capabilities, Support
from sonarium.transcription.contract import TranscriptionProvider, TranscriptionRequest

SAMPLE_SECONDS = 3.0
SAMPLE_FREQUENCY = 440

_STILL_UNKNOWN = "not established"


@dataclass(frozen=True, slots=True)
class Finding:
    """One question the probe asked, and what came back.

    ``ok`` is ``None`` where the probe could not establish an answer rather than establishing a
    bad one -- which is most of what a tone can say about an engine, and is not a failure.
    """

    question: str
    answer: str
    ok: bool | None = None


@dataclass(frozen=True, slots=True)
class ProbeReport:
    """What one engine said about itself when asked with real audio."""

    usable: bool
    """Whether this endpoint and model can produce what the archive stores. The one answer an
    operator needs before configuring anything."""

    detail: str
    capabilities: Capabilities
    findings: tuple[Finding, ...]

    reached: bool = True
    """Whether anything answered at all. An address nobody is listening at and a model that
    refuses the request are both unusable and are fixed differently, so they are reported apart."""


def sample_audio(destination: Path, *, seconds: float = SAMPLE_SECONDS) -> Path:
    """Three seconds of tone, so the probe sends nothing of anybody's.

    ffmpeg is already in the image for every other media task, and generating the sample is what
    lets this run on an instance with no recordings in it yet.
    """
    destination.parent.mkdir(parents=True, exist_ok=True)
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
            f"sine=frequency={SAMPLE_FREQUENCY}:duration={seconds}",
            str(destination),
        ],
        timeout=60,
    )
    return destination


def probe(
    provider: TranscriptionProvider,
    *,
    audio: Path,
    duration_ms: int,
    user_id: int = 0,
) -> ProbeReport:
    """Send one short piece of audio and report what the engine did with it.

    A :class:`~sonarium.core.errors.ProviderError` is the answer rather than an accident: the
    provider's own messages already say what went wrong and what to do about it, and reporting
    them here is what turns a failure after an upload into a sentence before one.
    """
    request = TranscriptionRequest(
        audio=audio,
        duration_ms=duration_ms,
        user_id=user_id,
        filename=audio.name,
    )
    try:
        handle = provider.submit(request)
        result = provider.poll(handle)
    except ProviderUnreachableError as error:
        return ProbeReport(
            usable=False,
            reached=False,
            detail=str(error),
            capabilities=provider.capabilities,
            findings=(Finding("Answers at all", "nothing answered", False),),
        )
    except ProviderError as error:
        return ProbeReport(
            usable=False,
            detail=str(error),
            capabilities=provider.capabilities,
            findings=(Finding("Answers, and in a shape that carries segments", "refused", False),),
        )
    if result is None:
        return ProbeReport(
            usable=False,
            detail="The engine accepted the audio and then returned no result.",
            capabilities=provider.capabilities,
            findings=(Finding("Returns a result", "accepted the audio, answered nothing", False),),
        )

    segments = result.segments
    speakers = {segment.speaker for segment in segments if segment.speaker}
    durations = sorted(segment.duration_ms for segment in segments)
    granularity = durations[len(durations) // 2] if durations else None
    furthest = max((segment.end_ms for segment in segments), default=0)

    findings = [
        Finding("Answers, and in a shape that carries segments", "yes", True),
        Finding("Reports a language", result.language or _STILL_UNKNOWN, None),
        Finding(
            "Returned timed segments",
            f"{len(segments)}" if segments else "none, which a tone need not produce",
            True if segments else None,
        ),
    ]
    if segments:
        findings.append(
            Finding(
                "Timings land inside the audio submitted",
                f"last segment ends at {furthest}ms of {duration_ms}ms",
                furthest <= duration_ms * 1.5,
            )
        )
        findings.append(
            Finding("Segment length, typically", f"{granularity}ms", None),
        )
    findings.append(
        Finding(
            "Names speakers",
            f"yes, {len(speakers)} in this sample" if speakers else _STILL_UNKNOWN,
            True if speakers else None,
        )
    )
    return ProbeReport(
        usable=True,
        detail=(
            "This engine answers in the shape the archive stores."
            if segments
            else "This engine answers in the shape the archive stores. It found no speech in a "
            "tone, which is expected; pass a real recording to see segments."
        ),
        capabilities=_observed(provider.capabilities, speakers, granularity),
        findings=tuple(findings),
    )


def _observed(
    declared: Capabilities, speakers: set[str], granularity_ms: int | None
) -> Capabilities:
    """The declaration, improved by what was actually seen.

    Only ever upgrades an unknown into an answer. Seeing no speakers in three seconds of tone is
    not evidence that an engine cannot name them, so absence leaves the unknown alone -- the same
    asymmetry ``destination.is_local`` is built on, for the same reason.
    """
    diarisation = Support.YES if speakers else declared.diarisation
    return replace(
        declared,
        diarisation=diarisation,
        granularity_ms=granularity_ms if granularity_ms is not None else declared.granularity_ms,
    )
