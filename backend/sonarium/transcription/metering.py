"""Usage metering (``JOB-2``).

Audio-seconds submitted, per user, per provider. An engine charges the operator by the second, so
how much an instance sent is a question somebody eventually asks -- and counting it afterwards is a
migration rather than a feature, which is why the shape exists before anything reads it.

**Nothing stores any of this yet, and that is the decision rather than an omission** (``REV-5``).
There is no ``usage`` table, and ``build_provider`` is called without a sink from both the API and
the CLI, so the only implementation below is the in-memory one. A table now would buy three
standing obligations -- ``export``, ``import`` and ``fsck`` each have to keep it honest, and their
round trip is ``ING-11``'s exit criterion -- for a consumer that does not exist. The interface
costs nothing and stays; the rows land with the first thing that reads them.

**Metering records what was submitted, not what succeeded.** An engine bills for the audio it
received whether or not it then failed, and a meter that only counted successes would drift away
from the bill in the direction that costs the operator money. A failed submission is recorded with
its outcome, so the two questions -- what was sent, what worked -- stay separable.

Nothing here touches the database. The worker owns the sink, on the day there is one.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Protocol

from sonarium.core.time import now_instant


@dataclass(frozen=True, slots=True)
class UsageRecord:
    """One submission's worth of usage."""

    provider: str
    model: str
    user_id: int
    audio_seconds: float
    audio_id: int | None = None
    recorded_at: str = ""
    """A fixed-width UTC instant, filled in by :func:`record` when it is not given."""

    outcome: str = "submitted"
    """``submitted`` | ``completed`` | ``failed`` -- what was billed, and what came of it."""


class UsageSink(Protocol):
    """Wherever usage goes. The worker is where a database implementation would be wired in."""

    def record(self, usage: UsageRecord) -> None:
        """Store one record. Must not raise: a metering failure cannot lose a transcription."""
        ...


class InMemoryUsage:
    """A sink that keeps records in a list, for tests and for a provider used outside a worker."""

    def __init__(self) -> None:
        self.records: list[UsageRecord] = []

    def record(self, usage: UsageRecord) -> None:
        self.records.append(usage)

    def seconds_for(self, user_id: int) -> float:
        """How much audio one account has submitted, which is what a credit balance is."""
        return sum(row.audio_seconds for row in self.records if row.user_id == user_id)


def record(sink: UsageSink | None, usage: UsageRecord) -> UsageRecord:
    """Stamp a record with the moment and hand it to the sink, if there is one.

    A missing sink is not an error: a provider is usable on its own, from the CLI or a test, and
    refusing to transcribe because nobody was counting would be the wrong trade.
    """
    stamped = usage if usage.recorded_at else replace(usage, recorded_at=now_instant())
    if sink is not None:
        sink.record(stamped)
    return stamped
