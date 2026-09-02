"""The OpenAI-compatible provider (``JOB-3``).

``POST /v1/audio/transcriptions`` with ``response_format=verbose_json``, which is what returns
segments rather than prose. The reference deployment is a local ``faster-whisper`` behind a server
that speaks this shape; a hosted endpoint is the alternative path (``DEC-18``).

Servers in this family disagree with each other about details that matter, so the parsing here is
deliberately forgiving in one direction and strict in the other: it accepts the several shapes
they really return, and refuses anything it cannot be *sure* it understood. A transcript whose
timestamps are silently a thousand times out is worse than a failure -- it reads perfectly and
every click seeks to the wrong place.

Errors say what happened and what to do about it. An administrator reading them is usually
looking at a URL they typed wrong.
"""

from __future__ import annotations

from http import HTTPStatus
from pathlib import Path
from typing import Any

import httpx
from pydantic import SecretStr

from sonarium.core.errors import ProviderError
from sonarium.core.ids import new_uuid
from sonarium.transcription.contract import (
    TranscriptionHandle,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSegment,
    redact,
    resolve_language,
)
from sonarium.transcription.metering import UsageRecord, UsageSink, record

PROVIDER_NAME = "openai-compatible"
DEFAULT_MODEL = "whisper-1"

_SECONDS_TO_MS = 1000
_PLAUSIBLE_MS_FACTOR = 10.0
"""How far past the submitted duration a value has to be before it is obviously milliseconds
already rather than seconds. Ten times is not a close call."""


class OpenAiCompatibleProvider:
    """One engine, reached over HTTP.

    One-shot: the request returns the answer, so :meth:`submit` produces a handle that is already
    complete and :meth:`poll` has nothing left to do. It satisfies the submit-and-poll protocol
    all the same, so the worker has one shape to drive and a genuinely asynchronous engine can be
    added later without the worker changing.
    """

    def __init__(
        self,
        *,
        base_url: str,
        api_key: SecretStr | None = None,
        model: str = DEFAULT_MODEL,
        default_language: str | None = None,
        timeout: float = 900.0,
        usage: UsageSink | None = None,
        client: httpx.Client | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._default_language = default_language
        self._timeout = timeout
        self._usage = usage
        self._client = client or httpx.Client(timeout=timeout)

    @property
    def name(self) -> str:
        return PROVIDER_NAME

    @property
    def model(self) -> str:
        return self._model

    def submit(self, request: TranscriptionRequest) -> TranscriptionHandle:
        """Send one part and keep the answer on the handle."""
        record(
            self._usage,
            UsageRecord(
                provider=self.name,
                model=self._model,
                user_id=request.user_id,
                audio_seconds=request.duration_ms / 1000,
                audio_id=request.audio_id,
                outcome="submitted",
            ),
        )
        payload = self._post(request)
        result = self._read(payload, request)
        return TranscriptionHandle(
            provider=self.name,
            external_id=new_uuid(),
            submitted_duration_ms=request.duration_ms,
            result=result,
        )

    def poll(self, handle: TranscriptionHandle) -> TranscriptionResult | None:
        """Nothing to wait for: this engine answered inside :meth:`submit`."""
        return handle.result

    def cancel(self, handle: TranscriptionHandle) -> None:
        """Nothing in flight to cancel."""

    def close(self) -> None:
        self._client.close()

    # --- The HTTP part ----------------------------------------------------

    def _post(self, request: TranscriptionRequest) -> dict[str, Any]:
        url = f"{self._base_url}/audio/transcriptions"
        headers = {}
        if self._api_key is not None:
            headers["Authorization"] = f"Bearer {self._api_key.get_secret_value()}"
        data: dict[str, str] = {"model": self._model, "response_format": "verbose_json"}
        language = resolve_language(request.language, instance_default=self._default_language)
        if language is not None:
            data["language"] = language
        try:
            with Path(request.audio).open("rb") as handle:
                response = self._client.post(
                    url,
                    headers=headers,
                    data=data,
                    files={"file": (request.submitted_name, handle, "application/octet-stream")},
                    timeout=self._timeout,
                )
        except httpx.ConnectError as error:
            raise ProviderError(
                f"Could not reach the transcription service at {url}. Check that it is running "
                "and that SONARIUM_TRANSCRIPTION_BASE_URL points at it."
            ) from error
        except httpx.TimeoutException as error:
            raise ProviderError(
                f"The transcription service at {url} did not answer within "
                f"{self._timeout:.0f}s. A long recording is submitted in parts, so a timeout "
                "here usually means the service is overloaded rather than the file being large."
            ) from error
        self._raise_for_status(response, url)
        try:
            body = response.json()
        except ValueError as error:
            raise ProviderError(
                f"The transcription service at {url} answered with something that is not JSON. "
                "That usually means the URL is a web page rather than an API endpoint."
            ) from error
        if not isinstance(body, dict):
            raise ProviderError("The transcription service answered with an unexpected shape.")
        return body

    def _raise_for_status(self, response: httpx.Response, url: str) -> None:
        if response.is_success:
            return
        detail = redact(response.text[:400], self._api_key)
        if response.status_code in (HTTPStatus.UNAUTHORIZED, HTTPStatus.FORBIDDEN):
            raise ProviderError(
                "The transcription service rejected the credentials. Check "
                f"SONARIUM_TRANSCRIPTION_API_KEY. It said: {detail}"
            )
        if response.status_code == HTTPStatus.REQUEST_ENTITY_TOO_LARGE:
            raise ProviderError(
                "The transcription service refused the request as too large. Long recordings are "
                "already submitted in parts; lower SONARIUM_TRANSCRIPTION_REQUEST_MAX_BYTES so "
                "the parts are smaller."
            )
        if response.status_code == HTTPStatus.NOT_FOUND:
            raise ProviderError(
                f"There is no transcription endpoint at {url}. "
                "SONARIUM_TRANSCRIPTION_BASE_URL should end in /v1."
            )
        raise ProviderError(f"The transcription service answered {response.status_code}: {detail}")

    def _read(self, payload: dict[str, Any], request: TranscriptionRequest) -> TranscriptionResult:
        """Turn one server's answer into segments, whatever dialect it speaks."""
        raw = payload.get("segments")
        if raw is None:
            raise ProviderError(
                "The transcription service returned no segments. Sonarium stores transcripts as "
                "timed segments, never as a wall of text, so plain output cannot be used. Ask it "
                "for response_format=verbose_json."
            )
        if not isinstance(raw, list):
            raise ProviderError("The transcription service returned segments in an unusable shape.")
        scale = self._time_scale(raw, request.duration_ms)
        segments = tuple(self._segment(entry, scale) for entry in raw if isinstance(entry, dict))
        if not segments and raw:
            raise ProviderError("The transcription service returned segments it could not read.")
        language = payload.get("language")
        return TranscriptionResult(
            provider=self.name,
            model=str(payload.get("model") or self._model),
            language=str(language) if isinstance(language, str) and language else None,
            segments=segments,
        )

    def _time_scale(self, raw: list[Any], duration_ms: int) -> float:
        """Whether this server speaks seconds or milliseconds.

        The submitted duration is the only trustworthy anchor. Servers in this family disagree,
        and getting it wrong is invisible on the page and wrong by a factor of a thousand in the
        player -- so the question is answered rather than assumed.
        """
        ends = [
            float(entry["end"])
            for entry in raw
            if isinstance(entry, dict) and _is_number(entry.get("end"))
        ]
        if not ends or duration_ms <= 0:
            return _SECONDS_TO_MS
        furthest = max(ends)
        if furthest > duration_ms / _PLAUSIBLE_MS_FACTOR:
            return 1.0
        return _SECONDS_TO_MS

    def _segment(self, entry: dict[str, Any], scale: float) -> TranscriptSegment:
        start = float(entry.get("start") or 0) * scale
        end = float(entry.get("end") or 0) * scale
        speaker = entry.get("speaker")
        return TranscriptSegment(
            start_ms=max(0, round(start)),
            end_ms=max(0, round(max(end, start))),
            text=str(entry.get("text") or "").strip(),
            speaker=str(speaker) if isinstance(speaker, str) and speaker else None,
        )


def _is_number(value: object) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)
