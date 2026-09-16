"""A ceiling on what a request body may be, enforced before it is read (``SEC-1``).

Every other limit in the application runs inside an endpoint, which means it runs after the body
has already arrived. That is the wrong order for the one endpoint that takes gigabytes:
``UploadFile`` is a spooled temporary file, so by the time ``upload`` gets to compare anything
against ``SONARIUM_MAX_UPLOAD_BYTES``, the bytes are on disk. And the body is parsed before the
dependency that authenticates the caller, so *a request with no session at all* can put them
there. The image points ``TMPDIR`` inside the data volume, so that is the same disk the database
and the originals are on.

So the check moves out to ASGI, where it can answer before anything is read:

* **A declared length over the ceiling is refused outright.** Nothing is buffered, nothing is
  parsed, and the caller is never authenticated -- there is no point knowing who sent a body this
  instance will not accept.
* **A body with no declared length is counted as it arrives**, and the request is unwound on the
  chunk that crosses the line. A chunked sender cannot avoid the ceiling by not mentioning it.

**Two ceilings, because there are two kinds of request.** A recording is measured in gigabytes and
a sign-in is measured in bytes, and one number for both would either refuse the upload or leave
``POST /auth/session`` able to hand an eight-gigabyte password to Argon2. The content type is what
separates them, which is the only thing available before the body is read.

This is a ceiling, not rate limiting: it bounds one request, not how many. The reverse proxy is
still the right place for the second question, and ``deploy/README.md`` says so.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from sonarium.core.config import MEGABYTE

if TYPE_CHECKING:
    from starlette.types import ASGIApp, Message, Receive, Scope, Send

MULTIPART_ENVELOPE_BYTES = MEGABYTE
"""Slack over the upload ceiling for the multipart wrapper itself.

The boundary markers, the part headers and the other fields of the form are all body bytes that
are not the recording, so a ceiling of exactly ``max_upload_bytes`` would refuse a file of exactly
that size. A megabyte is far more than the envelope ever is and far less than the thing it guards.
"""

_MULTIPART = "multipart/form-data"

_PROBLEM_TYPE = b"application/problem+json"


class RequestSizeLimit:
    """Refuse a request body larger than this instance accepts, before reading it.

    Written against raw ASGI rather than as a ``BaseHTTPMiddleware``, for the reason
    :class:`~sonarium.api.logging.RequestCorrelationMiddleware` gives: the streaming endpoint
    serves ``Range`` responses out of a file, and a buffering middleware in front of those turns a
    seek into a stall.
    """

    def __init__(self, app: ASGIApp, *, upload_bytes: int, body_bytes: int) -> None:
        self.app = app
        self._upload_bytes = upload_bytes + MULTIPART_ENVELOPE_BYTES
        self._body_bytes = body_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        limit = self._limit_for(scope)
        declared = _declared_length(scope)
        if declared is not None and declared > limit:
            await _refuse(send, limit)
            return

        counted = 0
        refused = False

        async def counting_receive() -> Message:
            """Measure the body as it arrives, and answer the moment it is too long.

            The refusal is sent from **here** rather than raised, which looks indirect and is the
            only thing that works: FastAPI reads the body inside a ``try`` that turns any
            exception into ``400 There was an error parsing the body``, so a middleware that
            raised would be told off for the shape of a body it had refused to read. Answering
            first and then reporting a disconnect leaves the application nothing to do but unwind.
            """
            nonlocal counted, refused
            if refused:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] != "http.request":
                return message
            counted += len(message.get("body", b""))
            if counted > limit:
                refused = True
                await _refuse(send, limit)
                return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            """Drop whatever the application says after it has already been answered."""
            if not refused:
                await send(message)

        await self.app(scope, counting_receive, guarded_send)

    def _limit_for(self, scope: Scope) -> int:
        """Which of the two ceilings this request is measured against."""
        return self._upload_bytes if _is_multipart(scope) else self._body_bytes


def _header(scope: Scope, name: bytes) -> bytes | None:
    headers: list[tuple[bytes, bytes]] = scope.get("headers") or []
    for key, value in headers:
        if key.lower() == name:
            return value
    return None


def _is_multipart(scope: Scope) -> bool:
    """Whether this request carries a form, which is how a recording arrives."""
    content_type = _header(scope, b"content-type") or b""
    return content_type.lower().startswith(_MULTIPART.encode())


def _declared_length(scope: Scope) -> int | None:
    """``Content-Length``, when the sender gave one that is a number.

    A sender is free to lie downwards, which is why the counting path exists as well. Lying
    upwards only refuses their own request.
    """
    raw = _header(scope, b"content-length")
    if raw is None:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


async def _refuse(send: Send, limit: int) -> None:
    """Answer 413 in the same problem shape every other failure uses.

    Built by hand rather than raised: this runs outside the exception handlers, which are
    installed on the application this middleware wraps.
    """
    megabytes = limit // MEGABYTE
    body = json.dumps(
        {
            "type": "/errors/too_large",
            "title": "Too large",
            "detail": (
                f"This request is larger than this instance accepts ({megabytes} MB). "
                "A recording goes to the upload endpoint, which has a much larger ceiling of "
                "its own; raise SONARIUM_MAX_UPLOAD_BYTES if that is the one you have hit."
            ),
            "status": 413,
        }
    ).encode()
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", _PROBLEM_TYPE),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
