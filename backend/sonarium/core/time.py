"""Time handling.

Two kinds of value share the ``TEXT`` column type and must never be treated alike (``DEC-11``).

**Instants** -- ``created_at``, ``deleted_at``, job and session times. UTC ISO-8601 with
milliseconds and a ``Z`` suffix, *fixed width*, so lexicographic order is chronological order and
SQLite can sort them without parsing.

**A recording's own time** -- ``recorded_at``. A local wall-clock string, with the offset kept
apart in ``recorded_at_offset`` (minutes) when it is genuinely known and ``NULL`` when it is not.
Rendered as written, never converted: a recording made at half six in the evening was made at half
six in the evening, permanently.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta

INSTANT_WIDTH = 24
"""Every instant is exactly this many characters, which is what makes ordering work."""

_INSTANT_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
_WALL_CLOCK_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")

WALL_CLOCK_FORMAT = "%Y-%m-%dT%H:%M:%S"

PRECISION_DATE = "date"
PRECISION_MINUTE = "minute"
PRECISION_SECOND = "second"
"""How much of a wall clock was actually stated (``ING-12``).

The stored form is fixed width, so a reading derived from a source that gave only a day still
carries ``00:00:00``. These say which of those digits mean anything, and they live here rather
than beside the deriver because the value travels further than that: the access layer sets it when
somebody types a date in, and only ``core`` is below both.
"""


# --- Instants --------------------------------------------------------------


def utc_now() -> datetime:
    """The current instant, always timezone-aware."""
    return datetime.now(UTC)


def to_instant(moment: datetime) -> str:
    """Render an aware datetime as a fixed-width UTC instant.

    A naive datetime is rejected rather than assumed to be UTC: guessing here is how a recording
    ends up an hour out and nobody notices for a year.
    """
    if moment.tzinfo is None:
        raise ValueError("an instant needs a timezone-aware datetime; got a naive one")
    in_utc = moment.astimezone(UTC)
    return f"{in_utc:%Y-%m-%dT%H:%M:%S}.{in_utc.microsecond // 1000:03d}Z"


def now_instant() -> str:
    """The current instant, ready to be written to a column."""
    return to_instant(utc_now())


def instant_after(delta: timedelta, *, since: datetime | None = None) -> str:
    """An instant ``delta`` from now -- session expiry, retention deadlines."""
    return to_instant((since or utc_now()) + delta)


def is_instant(value: str) -> bool:
    """Whether a string is in the one accepted instant form."""
    return _INSTANT_RE.match(value) is not None


def parse_instant(value: str) -> datetime:
    """Read back a stored instant, strictly.

    Anything that is not the exact stored form is a bug upstream, not something to be lenient
    about: leniency is what lets a variable-width value into a column that is ordered as text.
    """
    if not is_instant(value):
        raise ValueError(f"not a fixed-width UTC instant: {value!r}")
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%f%z").astimezone(UTC)


# --- A recording's own time ------------------------------------------------


def to_wall_clock(moment: datetime) -> tuple[str, int | None]:
    """Split a datetime into the pair ``recorded_at`` / ``recorded_at_offset``.

    Returns the wall-clock text exactly as the clock read, plus the offset in minutes when the
    datetime carries one. An aware datetime keeps its own local reading -- it is *not* converted to
    UTC first, because that is the whole point of storing the two halves apart.
    """
    text = moment.strftime(WALL_CLOCK_FORMAT)
    if moment.tzinfo is None:
        return text, None
    offset = moment.utcoffset()
    if offset is None:
        return text, None
    return text, round(offset.total_seconds() / 60)


def is_wall_clock(value: str) -> bool:
    """Whether a string is in the one accepted wall-clock form."""
    return _WALL_CLOCK_RE.match(value) is not None


def parse_wall_clock(value: str) -> datetime:
    """Read back a stored wall clock as a naive datetime -- deliberately without a timezone."""
    if not is_wall_clock(value):
        raise ValueError(f"not a wall-clock reading: {value!r}")
    return datetime.strptime(value, WALL_CLOCK_FORMAT)  # noqa: DTZ007 -- naive on purpose


def wall_clock_offset(minutes: int | None) -> str:
    """Render an offset for display: ``+02:00``, ``-05:30``, or an empty string when unknown."""
    if minutes is None:
        return ""
    sign = "+" if minutes >= 0 else "-"
    magnitude = abs(minutes)
    return f"{sign}{magnitude // 60:02d}:{magnitude % 60:02d}"
