"""``Range`` parsing (``ING-7``).

Seeking is entirely a Range conversation. Get this wrong and a player silently downloads two
hours of audio to play thirty seconds in the middle -- which looks like slowness, not like a bug.
"""

from __future__ import annotations

import pytest
from sonarium.media.ranges import UnsatisfiableRangeError, parse_range

SIZE = 1000


def test_a_span_from_the_start() -> None:
    span = parse_range("bytes=0-499", SIZE)
    assert span is not None
    assert (span.start, span.end, span.length) == (0, 499, 500)


def test_a_span_in_the_middle_which_is_what_seeking_looks_like() -> None:
    span = parse_range("bytes=500-599", SIZE)
    assert span is not None
    assert (span.start, span.end) == (500, 599)


def test_an_open_ended_span_runs_to_the_end() -> None:
    """What a player sends when you drag the playhead and it wants everything after it."""
    span = parse_range("bytes=900-", SIZE)
    assert span is not None
    assert (span.start, span.end) == (900, 999)


def test_a_suffix_span_is_the_last_bytes() -> None:
    span = parse_range("bytes=-100", SIZE)
    assert span is not None
    assert (span.start, span.end) == (900, 999)


def test_a_suffix_longer_than_the_file_is_the_whole_file() -> None:
    span = parse_range("bytes=-5000", SIZE)
    assert span is not None
    assert (span.start, span.end) == (0, 999)


def test_an_end_past_the_file_is_clamped_rather_than_refused() -> None:
    span = parse_range("bytes=900-5000", SIZE)
    assert span is not None
    assert span.end == 999


def test_a_start_past_the_end_is_unsatisfiable() -> None:
    """416 with the length is what lets a player correct itself."""
    with pytest.raises(UnsatisfiableRangeError) as raised:
        parse_range("bytes=2000-3000", SIZE)
    assert raised.value.size == SIZE


def test_a_backwards_span_is_unsatisfiable() -> None:
    with pytest.raises(UnsatisfiableRangeError):
        parse_range("bytes=500-100", SIZE)


@pytest.mark.parametrize(
    "header", [None, "", "items=0-10", "bytes", "bytes=", "bytes=abc-def", "bytes=0-10, 20-30"]
)
def test_a_header_this_code_does_not_understand_serves_the_whole_file(header: str | None) -> None:
    """A header we do not understand is not a reason to refuse somebody their recording.

    The multi-range case is here deliberately: it is legal HTTP, no audio element has ever sent
    one, and serving the whole file is a correct answer to it.
    """
    assert parse_range(header, SIZE) is None


def test_a_range_against_an_empty_file_is_nothing_to_serve() -> None:
    assert parse_range("bytes=0-10", 0) is None


def test_the_content_range_header_names_the_whole_size() -> None:
    span = parse_range("bytes=100-199", SIZE)
    assert span is not None
    assert span.content_range(SIZE) == "bytes 100-199/1000"
