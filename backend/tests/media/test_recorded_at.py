"""Deriving when a recording was made (``ING-12``).

Without this, every ``recorded_at`` in an imported archive of old voice notes is ``NULL``, and
the field, the sort order and the card's decoration are all useless on day one -- for exactly the
archive the project exists for.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
from sonarium.core.time import PRECISION_DATE, PRECISION_MINUTE, PRECISION_SECOND
from sonarium.media import recorded_at
from sonarium.media.recorded_at import (
    SOURCE_CONTAINER,
    SOURCE_FILENAME,
    SOURCE_FILESYSTEM,
)


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Recording 2024-03-11 18.22.m4a", "2024-03-11T18:22:00"),
        ("Recording 2024-03-11 18.22.04.m4a", "2024-03-11T18:22:04"),
        ("20240311_182200.m4a", "2024-03-11T18:22:00"),
        ("VN-20240311-182200.m4a", "2024-03-11T18:22:00"),
        ("audio_2024-03-11_18-22-00.ogg", "2024-03-11T18:22:00"),
        ("signal-2024-03-11-182200.m4a", "2024-03-11T18:22:00"),
        ("AUD-20240311-123456.3gp", "2024-03-11T12:34:56"),
        ("20240311182204.wav", "2024-03-11T18:22:04"),
    ],
)
def test_the_moment_a_voice_note_app_put_in_the_name(filename: str, expected: str) -> None:
    """This is the source that rescues a decade of files nobody ever renamed."""
    found = recorded_at.from_filename(filename)
    assert found is not None
    assert found.wall_clock == expected
    assert found.source == SOURCE_FILENAME


@pytest.mark.parametrize(
    "filename", ["PTT-20240311-WA0007.opus", "AUD-20240311-WA0012.m4a", "IMG_20240311.mp4"]
)
def test_a_date_with_no_time_is_still_worth_having(filename: str) -> None:
    found = recorded_at.from_filename(filename)
    assert found is not None
    assert found.wall_clock.startswith("2024-03-11")
    assert found.precision == PRECISION_DATE, "so the interface shows a date, not 00:00"


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("Recording 2024-03-11 18.22.m4a", PRECISION_MINUTE),
        ("Recording 2024-03-11 18.22.04.m4a", PRECISION_SECOND),
        ("20240311_182200.m4a", PRECISION_SECOND),
        ("PTT-20240311-WA0007.opus", PRECISION_DATE),
    ],
)
def test_a_name_states_as_much_of_the_clock_as_it_wrote(filename: str, expected: str) -> None:
    """The stored reading is fixed width, so only this says which digits were stated."""
    found = recorded_at.from_filename(filename)
    assert found is not None
    assert found.precision == expected


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("2024-03-11T18:22:04.000000Z", PRECISION_SECOND),
        ("2024-03-11T18:22+02:00", PRECISION_MINUTE),
        ("2024-03-11", PRECISION_DATE),
    ],
)
def test_a_container_tag_that_gave_only_a_day_is_not_read_as_midnight(
    tag: str, expected: str
) -> None:
    """``date`` and ``date_recorded`` routinely hold a bare day, and parse as 00:00:00."""
    found = recorded_at.from_container({"date": tag})
    assert found is not None
    assert found.precision == expected


def test_an_mtime_states_a_second_because_that_is_what_it_is(tmp_path: Path) -> None:
    path = tmp_path / "note.m4a"
    path.write_bytes(b"x")
    found = recorded_at.from_filesystem(path)
    assert found is not None
    assert found.precision == PRECISION_SECOND


def test_a_filename_never_gets_an_offset() -> None:
    """The name says what the clock read. It does not say which clock."""
    found = recorded_at.from_filename("Recording 2024-03-11 18.22.m4a")
    assert found is not None
    assert found.offset_minutes is None


@pytest.mark.parametrize(
    "filename",
    ["20241311-182200.m4a", "note.m4a", "track 03.mp3", "18001301.wav"],
)
def test_something_that_is_not_a_date_is_not_treated_as_one(filename: str) -> None:
    """An impossible reading has to fall through rather than be clamped into a confident lie."""
    found = recorded_at.from_filename(filename)
    assert found is None or not found.wall_clock.startswith("2024-13")


def test_an_impossible_month_falls_through_to_the_next_source(tmp_path: Path) -> None:
    path = tmp_path / "20241311-182200.m4a"
    path.write_bytes(b"x")
    found = recorded_at.derive(path, original_filename=path.name)
    assert found is not None
    assert found.source == SOURCE_FILESYSTEM


def test_a_container_tag_in_utc_has_a_known_offset_of_zero() -> None:
    """Known is not the same as absent: a recorder that wrote UTC did know."""
    found = recorded_at.from_container({"creation_time": "2024-03-11T16:22:00.000000Z"})
    assert found is not None
    assert found.wall_clock == "2024-03-11T16:22:00"
    assert found.offset_minutes == 0
    assert found.source == SOURCE_CONTAINER


def test_a_container_tag_with_an_offset_keeps_its_own_reading() -> None:
    """DEC-11: rendered as written. 18:22+02:00 is not stored as 16:22."""
    found = recorded_at.from_container({"creation_time": "2024-03-11T18:22:00+02:00"})
    assert found is not None
    assert found.wall_clock == "2024-03-11T18:22:00"
    assert found.offset_minutes == 120


def test_the_quicktime_tag_phones_actually_write_is_read() -> None:
    found = recorded_at.from_container(
        {"com.apple.quicktime.creationdate": "2024-03-11T18:22:00+0100"}
    )
    assert found is not None
    assert found.wall_clock == "2024-03-11T18:22:00"


def test_an_unreadable_container_tag_is_ignored_rather_than_crashing() -> None:
    assert recorded_at.from_container({"creation_time": "now-ish"}) is None
    assert recorded_at.from_container({}) is None


def test_the_container_wins_over_the_filename(tmp_path: Path) -> None:
    """The recorder knew. The filename is a guess about what the recorder knew."""
    path = tmp_path / "Recording 2020-01-01 09.00.m4a"
    path.write_bytes(b"x")
    found = recorded_at.derive(
        path,
        format_tags={"creation_time": "2024-03-11T16:22:00.000000Z"},
        original_filename=path.name,
    )
    assert found is not None
    assert found.source == SOURCE_CONTAINER
    assert found.wall_clock.startswith("2024-03-11")


def test_the_filename_wins_over_the_filesystem(tmp_path: Path) -> None:
    """An mtime is almost always wrong once a file has been through two phones and a cloud."""
    path = tmp_path / "Recording 2024-03-11 18.22.m4a"
    path.write_bytes(b"x")
    os.utime(path, (time.time(), time.time()))
    found = recorded_at.derive(path, original_filename=path.name)
    assert found is not None
    assert found.source == SOURCE_FILENAME


def test_the_filesystem_is_the_last_resort_and_says_so(tmp_path: Path) -> None:
    path = tmp_path / "note.m4a"
    path.write_bytes(b"x")
    found = recorded_at.derive(path, original_filename=path.name)
    assert found is not None
    assert found.source == SOURCE_FILESYSTEM, (
        "recorded, so the interface can say where it came from"
    )


def test_a_file_that_is_not_there_yields_nothing(tmp_path: Path) -> None:
    assert recorded_at.derive(tmp_path / "gone.m4a", original_filename="gone.m4a") is None
