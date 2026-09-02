"""The provider contract itself (``JOB-2``)."""

from __future__ import annotations

import pytest
from pydantic import SecretStr
from sonarium.core.config import Settings
from sonarium.core.errors import ConfigurationError
from sonarium.transcription.contract import (
    AUTO_DETECT,
    TranscriptionResult,
    TranscriptSegment,
    redact,
    resolve_language,
)
from sonarium.transcription.metering import InMemoryUsage, UsageRecord, record
from sonarium.transcription.registry import build_provider


@pytest.mark.parametrize(
    ("requested", "default", "expected"),
    [
        (None, None, None),
        (None, "ca", "ca"),
        ("en", "ca", "en"),
        (AUTO_DETECT, "ca", None),
        ("", "ca", None),
        ("  en  ", None, "en"),
    ],
)
def test_the_language_rules(
    requested: str | None, default: str | None, expected: str | None
) -> None:
    """None means not asked, so the default decides; auto means asked for detection, which the
    default may not override -- or the per-request parameter is optional in name only."""
    assert resolve_language(requested, instance_default=default) == expected


def test_a_credential_is_removed_from_anything_about_to_be_logged() -> None:
    cleaned = redact("upstream said: Bearer sk-secret-value", SecretStr("sk-secret-value"))
    assert "sk-secret-value" not in cleaned


def test_a_short_string_is_not_treated_as_a_secret() -> None:
    """Below a few characters a "secret" is more likely a word that appears in ordinary text."""
    assert redact("the cat sat", "cat") == "the cat sat"


def test_a_segment_moves_to_another_timeline() -> None:
    moved = TranscriptSegment(1_000, 2_000, "x").shifted(600_000)
    assert (moved.start_ms, moved.end_ms) == (601_000, 602_000)


def test_plain_text_is_derived_and_never_stored() -> None:
    """A stored copy is how the direction of derivation gets reversed."""
    result = TranscriptionResult(
        provider="p",
        model="m",
        language=None,
        segments=(TranscriptSegment(0, 1, "the"), TranscriptSegment(1, 2, "village")),
    )
    assert result.plain_text() == "the village"
    assert not hasattr(result, "text")


def test_usage_is_stamped_with_a_moment_even_without_a_sink() -> None:
    stamped = record(None, UsageRecord(provider="p", model="m", user_id=1, audio_seconds=1.0))
    assert stamped.recorded_at


def test_a_provider_works_without_anybody_counting() -> None:
    """Refusing to transcribe because metering was not wired up would be the wrong trade."""
    sink = InMemoryUsage()
    record(sink, UsageRecord(provider="p", model="m", user_id=2, audio_seconds=5.0))
    assert sink.seconds_for(2) == 5.0


def test_the_configured_provider_is_the_one_built(tmp_path_factory: pytest.TempPathFactory) -> None:
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("d"),
        transcription_base_url="http://whisper:8000/v1",
    )
    assert build_provider(settings).name == "openai-compatible"


def test_an_unknown_provider_names_the_ones_that_exist(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("d"),
        transcription_provider="telepathy",
        transcription_base_url="http://x/v1",
    )
    with pytest.raises(ConfigurationError, match="openai-compatible"):
        build_provider(settings)


def test_an_unconfigured_endpoint_says_what_to_point_it_at(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    settings = Settings(data_dir=tmp_path_factory.mktemp("d"))
    with pytest.raises(ConfigurationError, match="faster-whisper"):
        build_provider(settings)
