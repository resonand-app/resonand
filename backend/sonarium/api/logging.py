"""Structured logs with request correlation (part of ``OPS-5``).

One line per request, with an id that also travels back to the caller in ``X-Request-Id`` and
appears in every problem response. When somebody reports that an upload failed, that id is the
whole difference between reading the log and guessing.

The renderer is chosen by configuration: ``json`` for a deployed instance, whose logs are read by
a machine, and ``console`` for development, where they are read by a person.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

import structlog
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from sonarium.core.ids import new_uuid

if TYPE_CHECKING:
    from sonarium.core.config import Settings

REQUEST_ID_HEADER = "x-request-id"

_HEALTH_PATHS = frozenset({"/healthz", "/readyz"})


def configure_logging(settings: Settings) -> None:
    """Point the standard library and structlog at the same renderer."""
    level = getattr(logging, settings.log_level.upper())
    renderer: structlog.typing.Processor = (
        structlog.processors.JSONRenderer()
        if settings.log_format == "json"
        else structlog.dev.ConsoleRenderer()
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(format="%(message)s", level=level, force=True)


class RequestCorrelationMiddleware:
    """Give every request an id, bind it to the log context, and time it.

    Written against the raw ASGI interface rather than ``BaseHTTPMiddleware`` on purpose: the
    streaming endpoint (``ING-7``) serves ``Range`` responses out of a file, and wrapping those in
    a buffering middleware is how a seek in a two-hour recording turns into a stall.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._logger = structlog.get_logger("sonarium.request")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _incoming_request_id(scope) or new_uuid()
        scope.setdefault("state", {})["request_id"] = request_id
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()
        status_code = 500

        async def send_with_request_id(message: Message) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = int(message["status"])
                headers = list(message.get("headers", []))
                headers.append((REQUEST_ID_HEADER.encode(), request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            path = str(scope.get("path", ""))
            if path not in _HEALTH_PATHS:
                self._logger.info(
                    "request",
                    method=scope.get("method"),
                    path=path,
                    status=status_code,
                    duration_ms=round((time.perf_counter() - started) * 1000, 1),
                )
            structlog.contextvars.unbind_contextvars("request_id")


def _incoming_request_id(scope: Scope) -> str | None:
    """Reuse an id a reverse proxy already assigned, so one request is one id end to end."""
    headers: list[tuple[bytes, bytes]] = scope.get("headers") or []
    for name, value in headers:
        if name.decode().lower() == REQUEST_ID_HEADER:
            candidate = value.decode()[:64].strip()
            if candidate:
                return candidate
    return None
