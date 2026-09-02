"""The timestamp convention (``DEC-11``): two kinds of value, never mixed."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta, timezone

import pytest
from sonarium.core.time import (
    INSTANT_WIDTH,
    instant_after,
    is_instant,
    is_wall_clock,
    parse_instant,
    parse_wall_clock,
    to_instant,
    to_wall_clock,
    utc_now,
    wall_clock_offset,
)


def test_an_instant_is_always_the_same_width() -> None:
    early = to_instant(datetime(2024, 3, 11, 18, 22, 4, 1000, tzinfo=UTC))
    late = to_instant(datetime(2024, 12, 31, 23, 59, 59, 999999, tzinfo=UTC))
    assert len(early) == len(late) == INSTANT_WIDTH


def test_instants_sort_chronologically_as_text() -> None:
    """This is the whole reason the width is fixed: SQLite orders them without parsing."""
    moments = [
        datetime(2024, 3, 11, 18, 22, 4, 5000, tzinfo=UTC),
        datetime(2024, 3, 11, 18, 22, 4, 500000, tzinfo=UTC),
        datetime(2024, 3, 11, 18, 22, 5, tzinfo=UTC),
        datetime(2025, 1, 1, tzinfo=UTC),
    ]
    rendered = [to_instant(moment) for moment in moments]
    assert rendered == sorted(rendered)


def test_an_instant_is_converted_to_utc() -> None:
    madrid = timezone(timedelta(hours=2))
    assert to_instant(datetime(2024, 3, 11, 18, 22, tzinfo=madrid)) == "2024-03-11T16:22:00.000Z"


def test_a_naive_datetime_is_refused_rather_than_assumed_to_be_utc() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        to_instant(datetime(2024, 3, 11, 18, 22))  # noqa: DTZ001 -- the point of the test


def test_an_instant_round_trips() -> None:
    moment = datetime(2024, 3, 11, 18, 22, 4, 123000, tzinfo=UTC)
    assert parse_instant(to_instant(moment)) == moment


@pytest.mark.parametrize(
    "value",
    [
        "2024-03-11T18:22:04Z",  # no milliseconds
        "2024-03-11T18:22:04.123456Z",  # microseconds
        "2024-03-11T18:22:04.123+02:00",  # an offset instead of Z
        "2024-03-11 18:22:04.123Z",  # a space instead of T
        "",
    ],
)
def test_anything_but_the_stored_form_is_refused(value: str) -> None:
    assert not is_instant(value)
    with pytest.raises(ValueError, match="fixed-width"):
        parse_instant(value)


def test_instant_after_stays_in_the_stored_form() -> None:
    assert is_instant(instant_after(timedelta(days=30), since=utc_now()))


def test_a_recording_keeps_its_own_reading() -> None:
    """A recording made at half six in the evening was made at half six in the evening."""
    madrid = timezone(timedelta(hours=2))
    text, offset = to_wall_clock(datetime(2024, 3, 11, 18, 22, tzinfo=madrid))
    assert text == "2024-03-11T18:22:00"
    assert offset == 120


def test_an_unknown_offset_is_null_rather_than_guessed() -> None:
    text, offset = to_wall_clock(datetime(2024, 3, 11, 18, 22))  # noqa: DTZ001 -- unknown offset
    assert text == "2024-03-11T18:22:00"
    assert offset is None


def test_a_wall_clock_reads_back_naive() -> None:
    assert is_wall_clock("2024-03-11T18:22:00")
    assert parse_wall_clock("2024-03-11T18:22:00").tzinfo is None


def test_a_wall_clock_refuses_an_instant() -> None:
    assert not is_wall_clock("2024-03-11T18:22:04.123Z")


@pytest.mark.parametrize(
    ("minutes", "rendered"),
    [(120, "+02:00"), (-330, "-05:30"), (0, "+00:00"), (None, "")],
)
def test_an_offset_renders_for_display(minutes: int | None, rendered: str) -> None:
    assert wall_clock_offset(minutes) == rendered
