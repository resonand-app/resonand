"""When a recording was actually made (``ING-12``).

**Recording date is not upload date, and nothing else populates it.** ``ffprobe`` returns
technical metadata only, so without this module every ``recorded_at`` in an imported archive of
old voice notes is ``NULL`` -- and the field, the sort order and the card's decoration are all
useless on day one, for exactly the archive the project exists for.

Three sources, in order of how much they know:

1. **The container's own tags.** A phone that wrote ``creation_time`` knows, and it usually knows
   the offset too.
2. **The filename.** Voice-note apps put the moment in the name, in a dozen shapes. This is the
   source that rescues a decade of ``PTT-20240311-WA0007.opus``.
3. **The filesystem's modification time.** Nearly always wrong by the time a file has been copied
   between phones and cloud accounts -- which is why it is last, and why the source is recorded
   and the field stays editable.

**The precision is never invented either.** A container tag that says ``2024-03-11`` and a
filename like ``PTT-20240311-WA0007.opus`` state a day and no hour, and the reading is stored as
``date`` precision so the interface can show ``11 Mar 2024`` rather than a midnight nobody stated
-- which on an archive of old voice notes is most of it.

**The offset is never invented.** A container tag in UTC has a *known* offset of zero. A filename
gives a wall-clock reading and no offset at all, and the answer to "what timezone was that?" is
that we do not know -- not the server's timezone, and not UTC. Guessing is precisely the mistake
``DEC-11`` exists to prevent: normalise a phone's ``18.22`` to UTC and the recording shows as
17:22 to somebody abroad and shifts again across a daylight-saving boundary. A recording made at
half six in the evening was made at half six in the evening, permanently.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from resonand.core.time import (
    PRECISION_DATE,
    PRECISION_MINUTE,
    PRECISION_SECOND,
    WALL_CLOCK_FORMAT,
    to_wall_clock,
)

SOURCE_CONTAINER = "container"
SOURCE_FILENAME = "filename"
SOURCE_FILESYSTEM = "filesystem"

_CONTAINER_TAGS = (
    "creation_time",
    "com.apple.quicktime.creationdate",
    "date",
    "date_recorded",
)

_EARLIEST_YEAR = 1900
_LATEST_YEAR = 2100

_ISO_TIME = re.compile(r"[T ]\d{2}:\d{2}(?P<seconds>:\d{2})?")

_FILENAME_PATTERNS: tuple[re.Pattern[str], ...] = (
    # 2024-03-11 18.22.04 / 2024_03_11-18_22 / 2024.03.11 18-22
    re.compile(
        r"(?P<year>\d{4})[-_.](?P<month>\d{2})[-_.](?P<day>\d{2})"
        r"[T\s_-]+(?P<hour>\d{2})[-_.:](?P<minute>\d{2})(?:[-_.:](?P<second>\d{2}))?"
    ),
    # 2024-03-11-182200: a separated date and then a run-together time. Signal writes this.
    re.compile(
        r"(?P<year>\d{4})[-_.](?P<month>\d{2})[-_.](?P<day>\d{2})"
        r"[T\s_-]+(?P<hour>\d{2})(?P<minute>\d{2})(?:(?P<second>\d{2}))?"
    ),
    # 20240311-182204 / 20240311_1822 / PTT-20240311-WA0007 has no time, see below
    re.compile(
        r"(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})"
        r"[T\s_-]+(?P<hour>\d{2})(?P<minute>\d{2})(?:(?P<second>\d{2}))?"
    ),
    # 20240311182204, all run together
    re.compile(
        r"(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})"
        r"(?P<hour>\d{2})(?P<minute>\d{2})(?P<second>\d{2})"
    ),
    # A date with no time at all: PTT-20240311-WA0007, AUD-20240311-WA0012
    re.compile(r"(?P<year>\d{4})(?P<month>\d{2})(?P<day>\d{2})"),
    # 11-03-2024, day first, only when the first field cannot be a year
    re.compile(r"(?P<day>\d{2})[-_.](?P<month>\d{2})[-_.](?P<year>\d{4})"),
)


@dataclass(frozen=True, slots=True)
class RecordedAt:
    """When a recording was made, how confidently, and where that came from."""

    wall_clock: str
    """Local reading, rendered as written. Never converted."""

    offset_minutes: int | None
    """Minutes east of UTC when genuinely known, ``None`` when it is not."""

    source: str
    """``container`` | ``filename`` | ``filesystem`` -- shown, so the reading can be judged."""

    precision: str
    """``date`` | ``minute`` | ``second`` -- how much the source said, not how much is stored.

    ``wall_clock`` always carries seconds because the stored form has a fixed width. This is what
    says which of those digits were stated: at ``date`` the hour and everything after it are
    padding, and rendering them is inventing a time.
    """


def derive(
    path: Path,
    *,
    format_tags: dict[str, str] | None = None,
    original_filename: str | None = None,
) -> RecordedAt | None:
    """Work out when a recording was made, from the best source that has an answer."""
    for candidate in (
        from_container(format_tags or {}),
        from_filename(original_filename or path.name),
        from_filesystem(path),
    ):
        if candidate is not None:
            return candidate
    return None


def from_container(format_tags: dict[str, str]) -> RecordedAt | None:
    """A creation time the recorder itself wrote, offset included when it gave one."""
    for tag in _CONTAINER_TAGS:
        raw = format_tags.get(tag)
        if not raw:
            continue
        parsed = _parse_iso(raw.strip())
        if parsed is None:
            continue
        moment, precision = parsed
        text, offset = to_wall_clock(moment)
        return RecordedAt(
            wall_clock=text,
            offset_minutes=offset,
            source=SOURCE_CONTAINER,
            precision=precision,
        )
    return None


def from_filename(filename: str) -> RecordedAt | None:
    """The moment a voice-note app put in the name.

    No offset, ever. The name says what the clock read; it does not say which clock.
    """
    stem = Path(filename).stem
    for pattern in _FILENAME_PATTERNS:
        for match in pattern.finditer(stem):
            parts = match.groupdict()
            moment = _build(parts)
            if moment is None:
                continue
            return RecordedAt(
                wall_clock=moment.strftime(WALL_CLOCK_FORMAT),
                offset_minutes=None,
                source=SOURCE_FILENAME,
                precision=_filename_precision(parts),
            )
    return None


def from_filesystem(path: Path) -> RecordedAt | None:
    """The file's modification time, as the last resort it is.

    Almost always wrong once a file has been copied between phones and cloud accounts, which is
    why the source is recorded: the interface can say where this came from rather than presenting
    a copy date as a recording date.
    """
    if not path.exists():
        return None
    moment = datetime.fromtimestamp(path.stat().st_mtime).astimezone()
    text, offset = to_wall_clock(moment)
    return RecordedAt(
        wall_clock=text,
        offset_minutes=offset,
        source=SOURCE_FILESYSTEM,
        precision=PRECISION_SECOND,
    )


def _parse_iso(raw: str) -> tuple[datetime, str] | None:
    """Read the several shapes of ISO-8601 that container tags actually contain."""
    text = raw.replace("Z", "+00:00")
    precision = _stated_precision(raw)
    for candidate in (text, text.replace(" ", "T"), text.split(".")[0]):
        try:
            parsed = datetime.fromisoformat(candidate)
        except ValueError:
            continue
        if parsed.tzinfo is None and raw.endswith("Z"):
            return parsed.replace(tzinfo=UTC), precision
        if not _plausible(parsed.year):
            return None
        return parsed, precision
    return None


def _stated_precision(raw: str) -> str:
    """How much of a clock the tag wrote.

    ``date`` and ``date_recorded`` frequently hold a bare ``2024-03-11``, which
    :func:`datetime.fromisoformat` reads as midnight -- so without this the one tag most likely to
    say nothing about the hour is the one that sounds most confident.
    """
    stated = _ISO_TIME.search(raw)
    if stated is None:
        return PRECISION_DATE
    return PRECISION_SECOND if stated.group("seconds") else PRECISION_MINUTE


def _filename_precision(parts: dict[str, str | None]) -> str:
    """How much of a clock the name wrote."""
    if parts.get("hour") is None:
        return PRECISION_DATE
    return PRECISION_SECOND if parts.get("second") is not None else PRECISION_MINUTE


def _build(parts: dict[str, str | None]) -> datetime | None:
    """Assemble a naive datetime, refusing an impossible one rather than clamping it.

    An impossible reading -- ``20241311``, a serial number that looks like a date -- has to fall
    through to the next pattern and then the next source. Clamping it to December would put a
    confident wrong date on the recording, which is worse than having none.
    """
    try:
        year = int(parts["year"] or 0)
        if not _plausible(year):
            return None
        return datetime(  # noqa: DTZ001 -- naive on purpose: a filename knows no timezone
            year=year,
            month=int(parts["month"] or 0),
            day=int(parts["day"] or 0),
            hour=int(parts.get("hour") or 0),
            minute=int(parts.get("minute") or 0),
            second=int(parts.get("second") or 0),
        )
    except (TypeError, ValueError):
        return None


def _plausible(year: int) -> bool:
    """Reject a number that matched the shape of a year without being one."""
    return _EARLIEST_YEAR <= year <= _LATEST_YEAR
