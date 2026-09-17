"""The transcription provider contract (``JOB-2``).

Engine independence is principle 3: changing engine must cost nothing and lose nothing. Everything
here exists to make that true -- the rest of the backend knows an engine only through
:class:`TranscriptionProvider`, and nothing above this line knows what protocol a provider speaks.

**"Asynchronous" here means submit-and-poll, not ``async def``.** Section 6 of the specification
asks for an asynchronous contract with the external service and ``JOB-2`` repeats it; what that
buys is that a forty-minute interview is never one blocking call which has to survive forty
minutes. The rest of the backend is deliberately synchronous -- sync SQLAlchemy, plain ``def``
endpoints, an in-process worker running in threads -- so it is the *protocol* that is
asynchronous: a provider takes one part and hands back a :class:`TranscriptionHandle`, and the
worker polls that handle. A long transcription is then a sequence of short calls the worker can
interleave, retry and cancel, and ``job.external_id`` has something to hold. A provider that is
genuinely one-shot -- the OpenAI-compatible endpoint is one -- satisfies the same interface by
returning a handle that is already complete.

Three things are in the contract from the first implementation rather than added later, because
each of them is a rewrite if it arrives second:

* **Per-instance credentials**, read from configuration, never hard-coded and never logged. A
  provider composing a message from anything a server said runs it through :func:`redact` first:
  gateways do echo the key back in an error body.
* **Usage metering** -- see :mod:`sonarium.transcription.metering`. A credit-based service without
  metering is a rewrite, not a feature.
* **A language parameter**, optional per request, falling back to the instance default and meaning
  auto-detect when it resolves to ``None`` (``DEC-18``).

One thing is deliberately absent: plain text. A result is always segments with
``start_ms``/``end_ms``. Plain text, subtitles and playback-synchronised highlighting are derived
from segments, never the other way round -- prose cannot be re-timed, which is exactly what
``JOB-13`` has to do to every part it submits.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Final, Protocol

from pydantic import SecretStr

from sonarium.transcription.capabilities import Capabilities

AUTO_DETECT: Final = "auto"
"""Asks for detection explicitly, which the instance default may not override."""

_REDACTED: Final = "***"

_SHORTEST_REDACTABLE: Final = 6
"""Below this a "secret" is more likely to be a word that appears in ordinary text."""


def redact(text: str, *secrets: SecretStr | str | None) -> str:
    """Remove credentials from text that is about to be raised or logged.

    The rule the contract owes principle 2 is that a :class:`~pydantic.SecretStr` cannot end up in
    a log line or an exception message. Never interpolating one is the first half; this is the
    second, for the case nobody expects -- a proxy or gateway quoting the ``Authorization`` header
    back inside its own error body, which then goes into the message an administrator reads.
    """
    cleaned = text
    for secret in secrets:
        value = secret.get_secret_value() if isinstance(secret, SecretStr) else secret
        if value and len(value) >= _SHORTEST_REDACTABLE:
            cleaned = cleaned.replace(value, _REDACTED)
    return cleaned


def resolve_language(requested: str | None, *, instance_default: str | None) -> str | None:
    """Which language a request actually asks for (``DEC-18``).

    ``None`` on a request means *not asked*, so the instance default decides; the literal
    :data:`AUTO_DETECT` means *asked for detection*, which the instance default may not override.
    Without that distinction an instance whose default is Catalan could never be asked to detect,
    and the per-request parameter would be optional in name only. Either way what a provider
    receives is the engine's own convention: a code, or ``None`` for auto-detect.
    """
    chosen = instance_default if requested is None else requested
    if chosen is None or chosen == AUTO_DETECT or not chosen.strip():
        return None
    return chosen.strip()


@dataclass(frozen=True, slots=True)
class TranscriptSegment:
    """One timed piece of a transcript -- the only unit a transcript is made of.

    ``speaker`` is present even though diarisation is not implemented (specification section 6):
    the column exists from the first migration, so an engine that does diarise has somewhere to
    put its answer without a schema change, and every layer above already carries the field.
    """

    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None

    @property
    def duration_ms(self) -> int:
        """How long this piece of speech lasts."""
        return self.end_ms - self.start_ms

    def shifted(self, offset_ms: int) -> TranscriptSegment:
        """The same speech in another timeline -- ``JOB-13``'s whole job, in one line."""
        return replace(self, start_ms=self.start_ms + offset_ms, end_ms=self.end_ms + offset_ms)


@dataclass(frozen=True, slots=True)
class TranscriptionRequest:
    """One unit of audio handed to a provider: a whole recording, or one part of a long one.

    ``duration_ms`` is not optional. Metering bills for it, and ``JOB-3`` needs it to decide
    whether a server answered in seconds or in milliseconds -- the submitted length is the only
    trustworthy anchor for that question.

    ``user_id`` and ``audio_id`` are the internal integer ids, because the sink that receives the
    usage record writes them as foreign keys. Nothing in this package touches the database.
    """

    audio: Path
    duration_ms: int
    user_id: int
    filename: str | None = None
    language: str | None = None
    audio_id: int | None = None

    @property
    def submitted_name(self) -> str:
        """What the audio is called in the request body, which some servers key format off."""
        return self.filename or self.audio.name


@dataclass(frozen=True, slots=True)
class TranscriptionResult:
    """What an engine produced: segments, and the provenance a ``transcript`` row records."""

    provider: str
    model: str
    language: str | None
    segments: tuple[TranscriptSegment, ...]

    @property
    def end_ms(self) -> int:
        """Where the last speech ends, which is not the same as the audio's duration."""
        return max((segment.end_ms for segment in self.segments), default=0)

    def plain_text(self) -> str:
        """The transcript as prose, derived here and stored nowhere.

        Deriving it is a method rather than a field on purpose: the direction of derivation is a
        rule, and a stored copy is how it gets reversed.
        """
        return " ".join(segment.text for segment in self.segments if segment.text)


@dataclass(frozen=True, slots=True)
class TranscriptionHandle:
    """A submission in flight, and the only thing a worker needs to come back to it.

    ``external_id`` is what ``job.external_id`` holds. It is also *all* that survives a restart, so
    a one-shot provider -- which carries its answer inline in ``result`` -- loses an in-flight
    submission when the process dies. That is what ``JOB-1``'s ``idempotency_key`` is for: the
    recovered job re-submits, and the same part is not charged for twice by accident.
    """

    provider: str
    external_id: str
    submitted_duration_ms: int
    result: TranscriptionResult | None = None

    @property
    def is_complete(self) -> bool:
        """Whether polling this handle has anything left to do."""
        return self.result is not None


class TranscriptionProvider(Protocol):
    """One engine, behind the submit-and-poll protocol described at the top of this module."""

    @property
    def name(self) -> str:
        """The registry key this provider answers to, and the value stored in ``transcript``."""
        ...

    @property
    def model(self) -> str:
        """The model an engine will use, recorded so a re-transcription can be compared to it."""
        ...

    @property
    def capabilities(self) -> Capabilities:
        """What this engine can do, so that no caller has to assume it (``TRX-3``).

        Read per submission rather than cached by the worker: an engine's account of itself is
        allowed to improve once something has probed it, and a worker holding a copy from process
        start would go on chunking against an answer that has since been replaced.
        """
        ...

    def submit(self, request: TranscriptionRequest) -> TranscriptionHandle:
        """Hand over one part and return the handle that tracks it.

        Metering is recorded here, for what was submitted, before the outcome is known.
        """
        ...

    def poll(self, handle: TranscriptionHandle) -> TranscriptionResult | None:
        """The result if it is ready, ``None`` if it is not. Failure raises."""
        ...

    def cancel(self, handle: TranscriptionHandle) -> None:
        """Give up on a submission. A no-op where there is nothing to cancel."""
        ...

    def close(self) -> None:
        """Release whatever the provider holds open."""
        ...
