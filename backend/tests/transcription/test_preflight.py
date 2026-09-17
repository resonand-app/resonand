"""Asking an engine what it can do before sending it anything (``TRX-1``).

The case this exists for: an endpoint and a model that answer perfectly well and cannot produce
what the archive stores. Today that is found at the first real transcription, after the recording
has been uploaded.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from sonarium.transcription import preflight
from sonarium.transcription.capabilities import Support
from sonarium.transcription.openai_compatible import OpenAiCompatibleProvider

from tests.media.conftest import needs_ffmpeg

SEGMENTS: dict[str, Any] = {
    "language": "en",
    "segments": [
        {"start": 0.0, "end": 1.4, "text": "one two", "speaker": "SPEAKER_00"},
        {"start": 1.4, "end": 2.9, "text": "three", "speaker": "SPEAKER_01"},
    ],
}

REFUSES_VERBOSE_JSON = (
    '{"error": {"message": "response_format \'verbose_json\' is not supported with this model."}}'
)


def provider_answering(
    payload: dict[str, Any] | None = None, *, status: int = 200, text: str | None = None
) -> OpenAiCompatibleProvider:
    def handle(request: httpx.Request) -> httpx.Response:
        if text is not None:
            return httpx.Response(status, text=text)
        return httpx.Response(status, json=payload or {})

    return OpenAiCompatibleProvider(
        base_url="http://whisper.local:8000/v1",
        api_key=SecretStr("sk-not-a-real-key-at-all"),
        client=httpx.Client(transport=httpx.MockTransport(handle)),
    )


@pytest.fixture
def sample(tmp_path: Path) -> Path:
    path = tmp_path / "sample.opus"
    path.write_bytes(b"pretend this is three seconds of tone")
    return path


def test_an_engine_that_returns_segments_is_reported_usable(sample: Path) -> None:
    report = preflight.probe(provider_answering(SEGMENTS), audio=sample, duration_ms=3_000)
    assert report.usable is True
    assert all(finding.ok is not False for finding in report.findings)


def test_a_model_that_cannot_answer_in_verbose_json_is_caught_before_any_recording(
    sample: Path,
) -> None:
    """The whole point. The archive stores timed segments; this model cannot produce them."""
    provider = provider_answering(status=400, text=REFUSES_VERBOSE_JSON)
    report = preflight.probe(provider, audio=sample, duration_ms=3_000)
    assert report.usable is False
    assert "verbose_json" in report.detail
    assert "whisper-1" in report.detail, "it has to say what to do, not only what went wrong"


def test_a_model_returning_prose_instead_of_segments_is_refused(sample: Path) -> None:
    """A 200 is not an answer: ``json`` carries text and no timings."""
    report = preflight.probe(
        provider_answering({"text": "one two three"}), audio=sample, duration_ms=3_000
    )
    assert report.usable is False
    assert "segments" in report.detail


def test_credentials_are_never_echoed_into_a_report(sample: Path) -> None:
    """A gateway quoting the Authorization header back must not reach a terminal."""
    provider = provider_answering(status=401, text="rejected key sk-not-a-real-key-at-all")
    report = preflight.probe(provider, audio=sample, duration_ms=3_000)
    assert report.usable is False
    assert "sk-not-a-real-key-at-all" not in report.detail
    assert "***" in report.detail


def test_speakers_seen_in_the_sample_upgrade_the_declaration(sample: Path) -> None:
    report = preflight.probe(provider_answering(SEGMENTS), audio=sample, duration_ms=3_000)
    assert report.capabilities.diarisation is Support.YES
    assert report.capabilities.granularity_ms is not None


def test_seeing_no_speakers_in_a_tone_is_not_evidence_that_an_engine_cannot_name_them(
    sample: Path,
) -> None:
    """The same asymmetry ``destination.is_local`` is built on: absence proves nothing."""
    quiet = {"language": "en", "segments": [{"start": 0.0, "end": 1.0, "text": "hm"}]}
    report = preflight.probe(provider_answering(quiet), audio=sample, duration_ms=3_000)
    assert report.capabilities.diarisation is Support.UNKNOWN


def test_an_engine_finding_no_speech_in_a_tone_is_still_usable(sample: Path) -> None:
    """A tone has nothing to transcribe, so an empty segment list is a correct answer."""
    report = preflight.probe(
        provider_answering({"language": "en", "segments": []}), audio=sample, duration_ms=3_000
    )
    assert report.usable is True
    assert "pass a real recording" in report.detail


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_the_sample_is_generated_rather_than_taken_from_the_archive(tmp_path: Path) -> None:
    """It has to run on an instance with nothing in it, and send nobody's audio."""
    generated = preflight.sample_audio(tmp_path / "probe" / "sample.opus")
    assert generated.exists()
    assert generated.stat().st_size > 0
