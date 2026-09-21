"""What an engine declares about itself, and what the worker does with it (``TRX-3``).

The unit under test is the ceiling a long recording is cut against. It used to come from a
configured global whatever engine was behind it, so a forty-minute interview was cut into four
parts for an engine that would have taken it whole.
"""

from __future__ import annotations

from resonand.transcription.capabilities import Capabilities, Support, TimeUnit
from resonand.transcription.chunking import submission_ceiling
from resonand.transcription.openai_compatible import UNPROBED

MINUTE_MS = 60_000


def ceiling(
    capabilities: Capabilities, *, bytes_: int = 25 * 1024 * 1024, part_s: int = 600
) -> int:
    """Always explicit, so nothing in the environment can decide a ceiling in a test."""
    return submission_ceiling(
        capabilities, configured_max_bytes=bytes_, configured_max_part_ms=part_s * 1000
    )


def test_an_engine_that_declares_nothing_falls_back_to_the_configured_ceiling() -> None:
    assert ceiling(Capabilities()) == ceiling(UNPROBED)
    assert ceiling(Capabilities()) == 600 * 1000


def test_a_generous_engine_is_not_cut_against_a_hosted_endpoints_limit() -> None:
    """The point of the whole task, at the instance's own defaults.

    Five gigabytes and ten hours is AssemblyAI's figure; 25 MB and ten minutes is what the
    instance falls back to. Against the defaults, a forty-minute interview used to become four
    requests whatever engine was behind them.
    """
    roomy = Capabilities(max_request_bytes=5 * 1024 * 1024 * 1024, max_duration_ms=10 * 3_600_000)
    assert ceiling(roomy) > 40 * MINUTE_MS, "forty minutes should go in one request"


def test_a_stricter_engine_wins_over_a_looser_configuration() -> None:
    """The operator's number is a fallback, not permission to exceed what the engine takes."""
    strict = Capabilities(max_duration_ms=5 * MINUTE_MS)
    assert ceiling(strict) == 5 * MINUTE_MS


def test_each_configured_value_is_replaced_only_by_the_declaration_it_stands_in_for() -> None:
    """Declaring a byte limit says nothing about how long a part may be, and does not claim to."""
    roomy_in_bytes = Capabilities(max_request_bytes=5 * 1024 * 1024 * 1024)
    assert ceiling(roomy_in_bytes, part_s=120) == 120_000
    roomy_in_time = Capabilities(max_duration_ms=10 * 3_600_000)
    # A megabyte of Opus is about 157 seconds, and the declared ten hours does not lift it.
    assert ceiling(roomy_in_time, bytes_=1024 * 1024) < 3 * MINUTE_MS


def test_a_byte_limit_is_converted_at_the_bitrate_the_parts_are_encoded_at() -> None:
    """Parts are submitted as Opus at the derivative's bitrate, so this is arithmetic."""
    declared = Capabilities(max_request_bytes=6 * 1000 * 1000)
    # 6 MB at 48 kbps is a thousand seconds of audio, less a tenth for the envelope.
    assert 800_000 < ceiling(declared, part_s=10 * 3_600) < 1_000_000


def test_the_openai_compatible_family_declares_that_it_does_not_know() -> None:
    """The protocol fixes a URL shape. It fixes nothing about the model behind it."""
    assert UNPROBED.time_unit is TimeUnit.UNKNOWN
    assert UNPROBED.diarisation is Support.UNKNOWN
    assert UNPROBED.granularity_ms is None
    assert UNPROBED.has_declared_a_limit() is False
    assert UNPROBED.needs_reachable_url is False, "this family is handed the audio, not sent for it"


def test_a_declared_limit_is_distinguishable_from_no_limit() -> None:
    """The caller needs to tell 'took the fallback' from 'checked a real limit'."""
    assert Capabilities().has_declared_a_limit() is False
    assert Capabilities(max_request_bytes=1).has_declared_a_limit() is True
    assert Capabilities(max_duration_ms=1).has_declared_a_limit() is True
