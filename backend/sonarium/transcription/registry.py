"""Choosing an engine by configuration (``JOB-2``).

Engine independence (principle 3) is only real if the rest of the backend never names one. It
names this module instead, and this module names them from a single mapping -- so adding an engine
is one entry here and one file beside it, and no change anywhere else.
"""

from __future__ import annotations

from collections.abc import Callable

from sonarium.core.config import Settings
from sonarium.core.errors import ConfigurationError
from sonarium.transcription.contract import TranscriptionProvider
from sonarium.transcription.metering import UsageSink
from sonarium.transcription.openai_compatible import PROVIDER_NAME, OpenAiCompatibleProvider

Builder = Callable[[Settings, UsageSink | None], TranscriptionProvider]


def _openai_compatible(settings: Settings, usage: UsageSink | None) -> TranscriptionProvider:
    if not settings.transcription_base_url:
        raise ConfigurationError(
            "SONARIUM_TRANSCRIPTION_BASE_URL is not set, so nothing can be transcribed. Point it "
            "at a local faster-whisper server or an OpenAI-compatible endpoint, ending in /v1."
        )
    return OpenAiCompatibleProvider(
        base_url=settings.transcription_base_url,
        api_key=settings.transcription_api_key,
        model=settings.transcription_model,
        default_language=settings.transcription_language,
        timeout=settings.transcription_timeout_seconds,
        usage=usage,
    )


BUILDERS: dict[str, Builder] = {PROVIDER_NAME: _openai_compatible}


def build_provider(settings: Settings, *, usage: UsageSink | None = None) -> TranscriptionProvider:
    """The engine this instance is configured to use."""
    builder = BUILDERS.get(settings.transcription_provider)
    if builder is None:
        available = ", ".join(sorted(BUILDERS)) or "none"
        raise ConfigurationError(
            f"There is no transcription provider called "
            f"{settings.transcription_provider!r}. Available: {available}."
        )
    return builder(settings, usage)
