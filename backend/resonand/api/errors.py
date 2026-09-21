"""One error shape for the whole API.

Every failure leaves through here as ``application/problem+json`` with ``type``, ``title`` and
``detail`` (``API-1``), so a client -- the web interface is only one of them -- can branch on
``type`` and show ``detail`` without parsing prose. Two rules are load-bearing:

* Anything the caller cannot read at level 10 is a **404, not a 403** (``DEC-14``). That is decided
  in the access layer, which raises :class:`~resonand.core.errors.NotFoundError`; this module only
  has to not undo it.
* An unexpected exception says nothing about itself. The traceback goes to the log with the
  request id, and the response carries that id -- which is what makes a bug report actionable
  without leaking a stack trace to whoever asked.

Messages explain what happened and what to do. They do not apologise.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from resonand.core.errors import (
    ConfigurationError,
    ConflictError,
    InvalidRequestError,
    NotFoundError,
    PermissionDeniedError,
    ProviderError,
    ResonandError,
    ToolError,
    UnauthenticatedError,
)

PROBLEM_CONTENT_TYPE = "application/problem+json"

_logger = structlog.get_logger(__name__)

_STATUS_BY_ERROR: tuple[tuple[type[ResonandError], int, str], ...] = (
    (NotFoundError, status.HTTP_404_NOT_FOUND, "Not found"),
    (UnauthenticatedError, status.HTTP_401_UNAUTHORIZED, "Not signed in"),
    (PermissionDeniedError, status.HTTP_403_FORBIDDEN, "Not allowed"),
    (ConflictError, status.HTTP_409_CONFLICT, "Conflict"),
    (InvalidRequestError, status.HTTP_400_BAD_REQUEST, "Invalid request"),
    (ProviderError, status.HTTP_502_BAD_GATEWAY, "The transcription provider failed"),
    (ToolError, status.HTTP_500_INTERNAL_SERVER_ERROR, "A required tool failed"),
    (ConfigurationError, status.HTTP_500_INTERNAL_SERVER_ERROR, "The instance is misconfigured"),
)

_TITLES_BY_STATUS: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "Invalid request",
    status.HTTP_401_UNAUTHORIZED: "Not signed in",
    status.HTTP_403_FORBIDDEN: "Not allowed",
    status.HTTP_404_NOT_FOUND: "Not found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "Method not allowed",
    status.HTTP_409_CONFLICT: "Conflict",
    status.HTTP_413_CONTENT_TOO_LARGE: "Too large",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "Unsupported format",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "Invalid request",
    status.HTTP_429_TOO_MANY_REQUESTS: "Too many requests",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "Unexpected error",
    status.HTTP_502_BAD_GATEWAY: "Upstream failure",
    status.HTTP_503_SERVICE_UNAVAILABLE: "Not ready",
}

_LOCATION_KINDS = frozenset({"body", "query", "path", "header", "cookie"})

_CODES_BY_STATUS: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "invalid_request",
    status.HTTP_401_UNAUTHORIZED: "unauthenticated",
    status.HTTP_403_FORBIDDEN: "permission_denied",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_413_CONTENT_TOO_LARGE: "too_large",
    status.HTTP_415_UNSUPPORTED_MEDIA_TYPE: "unsupported_format",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "invalid_request",
    status.HTTP_429_TOO_MANY_REQUESTS: "too_many_requests",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "internal_error",
    status.HTTP_502_BAD_GATEWAY: "upstream_failure",
    status.HTTP_503_SERVICE_UNAVAILABLE: "not_ready",
}


@dataclass(frozen=True, slots=True)
class Problem:
    """A failure, in the form it will be serialised in."""

    status_code: int
    code: str
    title: str
    detail: str
    extra: dict[str, Any] = field(default_factory=dict)


def problem_response(request: Request, problem: Problem) -> JSONResponse:
    """Build the one response shape every failure uses."""
    body: dict[str, Any] = {
        "type": f"/errors/{problem.code}",
        "title": problem.title,
        "detail": problem.detail,
        "status": problem.status_code,
    }
    request_id = getattr(request.state, "request_id", None)
    if request_id is not None:
        body["request_id"] = request_id
    if problem.extra:
        body.update(problem.extra)
    headers = {"X-Request-Id": request_id} if request_id is not None else None
    return JSONResponse(
        body,
        status_code=problem.status_code,
        media_type=PROBLEM_CONTENT_TYPE,
        headers=headers,
    )


def _field_name(location: Sequence[str | int]) -> str:
    """The name the caller used, without the internal location prefix.

    Telling somebody that ``query.count`` is wrong when they wrote ``?count=`` makes them
    work out the mapping; naming the field they typed does not.
    """
    parts = list(location)
    if parts and parts[0] in _LOCATION_KINDS:
        parts = parts[1:]
    return ".".join(str(part) for part in parts)


def _status_and_title(error: ResonandError) -> tuple[int, str]:
    """Map a deliberate error onto its status, falling back to 500 for a new subclass."""
    for error_type, status_code, title in _STATUS_BY_ERROR:
        if isinstance(error, error_type):
            return status_code, title
    return status.HTTP_500_INTERNAL_SERVER_ERROR, "Unexpected error"


def install_error_handlers(app: FastAPI) -> None:
    """Route every kind of failure through :func:`problem_response`."""

    @app.exception_handler(ResonandError)
    async def _handle_resonand_error(request: Request, exc: Exception) -> JSONResponse:
        error = exc if isinstance(exc, ResonandError) else ResonandError(str(exc))
        status_code, title = _status_and_title(error)
        if status_code >= status.HTTP_500_INTERNAL_SERVER_ERROR:
            _logger.error("request.failed", code=error.code, detail=error.detail, exc_info=error)
        return problem_response(
            request,
            Problem(status_code=status_code, code=error.code, title=title, detail=error.detail),
        )

    @app.exception_handler(HTTPException)
    async def _handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
        http_error = exc if isinstance(exc, HTTPException) else HTTPException(500, str(exc))
        status_code = http_error.status_code
        detail = str(http_error.detail)
        return problem_response(
            request,
            Problem(
                status_code=status_code,
                code=_CODES_BY_STATUS.get(status_code, "error"),
                title=_TITLES_BY_STATUS.get(status_code, "Error"),
                detail=detail,
            ),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
        validation_error = exc if isinstance(exc, RequestValidationError) else None
        errors = validation_error.errors() if validation_error is not None else []
        fields = [
            {"field": _field_name(problem.get("loc", ())), "detail": problem.get("msg", "")}
            for problem in errors
        ]
        summary = fields[0]["detail"] if fields else "The request could not be read."
        return problem_response(
            request,
            Problem(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                code="invalid_request",
                title="Invalid request",
                detail=summary,
                extra={"errors": fields},
            ),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        _logger.exception("request.crashed", exc_info=exc)
        return problem_response(
            request,
            Problem(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                code="internal_error",
                title="Unexpected error",
                detail=(
                    "Something went wrong on the server. The request id in this response is "
                    "in the instance log and identifies exactly what failed."
                ),
            ),
        )
