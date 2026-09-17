"""The OpenAI-compatible provider (``JOB-3``).

Every test runs against a mocked transport. There is no transcription server here, and a test
that needed one would be a test nobody runs.

The theme is that servers in this family disagree with each other, and that the disagreements
which matter are the silent ones: a timestamp read in the wrong unit produces a transcript that
reads perfectly and plays wrong.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from sonarium.core.errors import ProviderError
from sonarium.transcription.capabilities import Capabilities, TimeUnit
from sonarium.transcription.contract import AUTO_DETECT, TranscriptionRequest
from sonarium.transcription.metering import InMemoryUsage
from sonarium.transcription.openai_compatible import OpenAiCompatibleProvider

API_KEY = "sk-a-secret-nobody-should-see"


@pytest.fixture
def audio(tmp_path: Path) -> Path:
    path = tmp_path / "note.opus"
    path.write_bytes(b"pretend this is audio")
    return path


def provider_returning(
    payload: dict[str, Any] | None = None,
    *,
    status: int = 200,
    text: str | None = None,
    raises: Exception | None = None,
    captured: list[httpx.Request] | None = None,
    usage: InMemoryUsage | None = None,
    default_language: str | None = None,
    capabilities: Capabilities | None = None,
) -> OpenAiCompatibleProvider:
    def handle(request: httpx.Request) -> httpx.Response:
        if captured is not None:
            captured.append(request)
        if raises is not None:
            raise raises
        if text is not None:
            return httpx.Response(status, text=text)
        return httpx.Response(status, json=payload or {})

    return OpenAiCompatibleProvider(
        base_url="http://whisper.local:8000/v1",
        api_key=SecretStr(API_KEY),
        usage=usage,
        default_language=default_language,
        capabilities=capabilities,
        client=httpx.Client(transport=httpx.MockTransport(handle)),
    )


def a_request(audio: Path, **overrides: Any) -> TranscriptionRequest:
    defaults: dict[str, Any] = {"audio": audio, "duration_ms": 60_000, "user_id": 1}
    return TranscriptionRequest(**(defaults | overrides))


# --- Reading what a server returned ---------------------------------------


def test_segments_in_seconds_become_milliseconds(audio: Path) -> None:
    provider = provider_returning({"segments": [{"start": 0.0, "end": 4.2, "text": "the village"}]})
    result = provider.submit(a_request(audio)).result
    assert result is not None
    assert result.segments[0].start_ms == 0
    assert result.segments[0].end_ms == 4_200


def test_segments_already_in_milliseconds_are_not_multiplied_again(audio: Path) -> None:
    """The submitted duration is the anchor: 42,000 in a 60-second part is not 42,000 seconds."""
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 42_000, "text": "the village"}]}
    )
    result = provider.submit(a_request(audio, duration_ms=60_000)).result
    assert result is not None
    assert result.segments[0].end_ms == 42_000


def test_a_mostly_silent_part_in_milliseconds_is_not_read_as_seconds(audio: Path) -> None:
    """``TRX-7``: the case the old margin let through, and the reason it matters.

    The last part of a recording is usually mostly silence, which is exactly what the planner
    produces whenever a recording ends with a long tail. A ten-minute part whose speaker stops
    after thirty seconds reports ``30000``; the old test asked whether that exceeded a tenth of
    the part's length in *milliseconds*, decided it did not, and multiplied by a thousand --
    placing the last line of the recording at 8h 20m.
    """
    provider = provider_returning({"segments": [{"start": 0, "end": 30_000, "text": "then quiet"}]})
    result = provider.submit(a_request(audio, duration_ms=600_000)).result
    assert result is not None
    assert result.segments[0].end_ms == 30_000


def test_a_seconds_server_is_still_read_as_seconds_at_the_very_end_of_a_part(
    audio: Path,
) -> None:
    """The bound has to admit speech that runs to the last moment of its part."""
    provider = provider_returning({"segments": [{"start": 0.0, "end": 600.0, "text": "all of it"}]})
    result = provider.submit(a_request(audio, duration_ms=600_000)).result
    assert result is not None
    assert result.segments[0].end_ms == 600_000


def test_a_declared_unit_is_not_second_guessed(audio: Path) -> None:
    """``TRX-3`` removes the guess for any engine that has been asked what it reports in."""
    declared = Capabilities(time_unit=TimeUnit.MILLISECONDS)
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 400, "text": "a short answer"}]}, capabilities=declared
    )
    result = provider.submit(a_request(audio, duration_ms=600_000)).result
    assert result is not None
    # Inference alone would have called 400 seconds, because it is under the part's 600.
    assert result.segments[0].end_ms == 400


def test_a_transcript_that_could_not_be_timed_fails_rather_than_being_stored(
    audio: Path,
) -> None:
    """A transcript that reads perfectly while every click lands hours away is worse than
    a failure, because only one of the two ever gets reported."""
    declared = Capabilities(time_unit=TimeUnit.SECONDS)
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 30_000, "text": "milliseconds, declared as seconds"}]},
        capabilities=declared,
    )
    with pytest.raises(ProviderError, match="cannot be read with confidence"):
        provider.submit(a_request(audio, duration_ms=600_000))


def test_a_last_segment_rounded_just_past_the_end_is_still_accepted(audio: Path) -> None:
    """Servers do round the final end past the part they were given. That is not the failure."""
    provider = provider_returning({"segments": [{"start": 0.0, "end": 60.4, "text": "to the end"}]})
    result = provider.submit(a_request(audio, duration_ms=60_000)).result
    assert result is not None
    assert result.segments[0].end_ms == 60_400


def test_the_speaker_field_is_carried_when_a_server_offers_it(audio: Path) -> None:
    """Diarisation is not implemented, and the field exists so that an engine that does has
    somewhere to put it without a schema change."""
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 1.0, "text": "hello", "speaker": "SPEAKER_01"}]}
    )
    result = provider.submit(a_request(audio)).result
    assert result is not None
    assert result.segments[0].speaker == "SPEAKER_01"


def test_a_server_that_returns_no_segments_is_refused(audio: Path) -> None:
    """Plain text cannot be re-timed, which is exactly what chunking has to do to it."""
    provider = provider_returning({"text": "the whole thing as one paragraph"})
    with pytest.raises(ProviderError, match="verbose_json"):
        provider.submit(a_request(audio))


def test_segments_in_an_unusable_shape_are_refused(audio: Path) -> None:
    provider = provider_returning({"segments": "not a list"})
    with pytest.raises(ProviderError, match="unusable shape"):
        provider.submit(a_request(audio))


def test_the_detected_language_is_reported_when_there_is_one(audio: Path) -> None:
    provider = provider_returning(
        {"language": "ca", "segments": [{"start": 0, "end": 1.0, "text": "hola"}]}
    )
    result = provider.submit(a_request(audio)).result
    assert result is not None
    assert result.language == "ca"


def test_a_backwards_segment_is_straightened_rather_than_stored(audio: Path) -> None:
    provider = provider_returning({"segments": [{"start": 5.0, "end": 1.0, "text": "odd"}]})
    result = provider.submit(a_request(audio)).result
    assert result is not None
    assert result.segments[0].end_ms >= result.segments[0].start_ms


# --- What a server said when it refused -----------------------------------


def test_a_rejected_key_names_the_setting_to_fix(audio: Path) -> None:
    provider = provider_returning(status=401, text="invalid api key")
    with pytest.raises(ProviderError, match="SONARIUM_TRANSCRIPTION_API_KEY"):
        provider.submit(a_request(audio))


def test_too_large_points_at_the_setting_that_makes_parts_smaller(audio: Path) -> None:
    provider = provider_returning(status=413, text="payload too large")
    with pytest.raises(ProviderError, match="parts are smaller"):
        provider.submit(a_request(audio))


def test_a_wrong_url_says_what_the_url_should_look_like(audio: Path) -> None:
    provider = provider_returning(status=404, text="not found")
    with pytest.raises(ProviderError, match=r"end in /v1"):
        provider.submit(a_request(audio))


def test_an_unreachable_service_repeats_the_url(audio: Path) -> None:
    provider = provider_returning(
        raises=httpx.ConnectError("no route to host", request=httpx.Request("POST", "http://x"))
    )
    with pytest.raises(ProviderError, match=r"whisper\.local"):
        provider.submit(a_request(audio))


def test_a_web_page_where_an_api_was_expected_says_so(audio: Path) -> None:
    provider = provider_returning(text="<html>Welcome</html>")
    with pytest.raises(ProviderError, match="not JSON"):
        provider.submit(a_request(audio))


def test_the_api_key_never_appears_in_an_error(audio: Path) -> None:
    """Gateways do echo the Authorization header back inside their own error bodies."""
    provider = provider_returning(status=500, text=f"upstream said: Bearer {API_KEY}")
    with pytest.raises(ProviderError) as raised:
        provider.submit(a_request(audio))
    assert API_KEY not in str(raised.value)


# --- The contract ---------------------------------------------------------


def test_the_language_asked_for_is_the_one_sent(audio: Path) -> None:
    captured: list[httpx.Request] = []
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 1.0, "text": "hola"}]},
        captured=captured,
        default_language="en",
    )
    provider.submit(a_request(audio, language="ca"))
    assert b"ca" in captured[0].content


def test_asking_for_detection_overrides_the_instance_default(audio: Path) -> None:
    """Otherwise an instance whose default is Catalan could never be asked to detect."""
    captured: list[httpx.Request] = []
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 1.0, "text": "x"}]},
        captured=captured,
        default_language="ca",
    )
    provider.submit(a_request(audio, language=AUTO_DETECT))
    assert b'name="language"' not in captured[0].content


def test_usage_is_metered_for_what_was_submitted(audio: Path) -> None:
    usage = InMemoryUsage()
    provider = provider_returning(
        {"segments": [{"start": 0, "end": 1.0, "text": "x"}]}, usage=usage
    )
    provider.submit(a_request(audio, duration_ms=90_000, user_id=7))
    assert usage.seconds_for(7) == 90.0
    assert usage.records[0].recorded_at, "a record without a moment is not an invoice line"


def test_usage_is_recorded_even_when_the_request_then_fails(audio: Path) -> None:
    """A paid endpoint bills for the audio it received whether or not it then failed."""
    usage = InMemoryUsage()
    provider = provider_returning(status=500, text="broke", usage=usage)
    with pytest.raises(ProviderError):
        provider.submit(a_request(audio, duration_ms=30_000, user_id=7))
    assert usage.seconds_for(7) == 30.0


def test_a_one_shot_provider_still_satisfies_submit_and_poll(audio: Path) -> None:
    """So the worker drives one shape, and a genuinely asynchronous engine can be added later."""
    provider = provider_returning({"segments": [{"start": 0, "end": 1.0, "text": "x"}]})
    handle = provider.submit(a_request(audio))
    assert handle.is_complete
    assert provider.poll(handle) is handle.result
    provider.cancel(handle)
