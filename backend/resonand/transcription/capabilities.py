"""What an engine can do, declared rather than assumed (``TRX-3``).

A provider used to be built from configuration, handed a file and asked for segments. It never
said how large a request it would take, how long a recording, what unit its timestamps were in or
whether it named speakers -- so every one of those facts lived in the operator's head and was
expressed, if at all, as a ``RESONAND_*`` variable they were expected to know the right value for.
The consequences were not cosmetic: a forty-minute interview was cut into four parts for an engine
that would have taken it whole, which is four requests where one would do, four times the failure
surface, and on a per-request biller four minimums instead of one.

**Unknown is a value here, not a gap.** "OpenAI-compatible" describes a URL shape and nothing
else; servers in that family genuinely disagree about units, about whether they diarise and about
how coarse a segment is, and an unprobed endpoint cannot be asked. Modelling that as a default --
``False`` for diarisation, seconds for the unit -- would be the same guess the code already makes,
wearing a declaration's clothes. So the record says *unknown*, the callers handle it explicitly,
and ``TRX-1``'s probe is what turns an unknown into an answer.

**This belongs to a provider instance and never to** :class:`~resonand.core.config.Settings`.
Several engines in one instance (``TRX-14``) and configuration held in the database rather than
the environment (``TRX-15``) both arrive by making more of these, which is additive only for as
long as nothing reads the answer off a global.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class TimeUnit(StrEnum):
    """What a server's ``start`` and ``end`` are counted in."""

    SECONDS = "seconds"
    MILLISECONDS = "milliseconds"
    UNKNOWN = "unknown"
    """Neither documented nor probed, so it has to be inferred from the submitted duration."""


class Support(StrEnum):
    """Whether an engine does something, where the answer can be genuinely unknown."""

    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"


@dataclass(frozen=True, slots=True)
class Capabilities:
    """One engine's own account of itself.

    Every limit is optional because *not declared* and *no limit* are different answers, and the
    caller that has to choose a chunking ceiling needs to tell them apart: a provider that has not
    said falls back to what the instance was configured with, and one that has said overrides it.
    """

    max_request_bytes: int | None = None
    """The largest single request, or ``None`` where the engine has not said."""

    max_duration_ms: int | None = None
    """The longest single recording, which is not derivable from the byte ceiling: a five-gigabyte
    limit still caps at ten hours, and the hour of driving hits the second one first."""

    time_unit: TimeUnit = TimeUnit.UNKNOWN
    diarisation: Support = Support.UNKNOWN
    granularity_ms: int | None = None
    """How long a segment this engine tends to return. ``None`` until something has measured it.
    Coarse segments are not only a display property -- they decide how precisely a click can seek,
    and they widen the overlap a seam needs (``TRX-11``)."""

    needs_reachable_url: bool = False
    """Whether the engine fetches the audio itself instead of being handed it. False for every
    engine that takes an upload, which is all of them today."""

    def has_declared_a_limit(self) -> bool:
        """Whether this engine has said anything about how much it will take at once.

        The caller needs the distinction to report what it did: an engine that declares nothing
        is chunked against the instance's configured ceiling, which is a fallback rather than a
        limit anybody checked.
        """
        return self.max_request_bytes is not None or self.max_duration_ms is not None
