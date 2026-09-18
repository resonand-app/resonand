"""The error vocabulary the whole backend shares.

Two rules are encoded here rather than left to each endpoint:

* Anything the caller cannot read at level 10 raises :class:`NotFoundError`, never
  :class:`PermissionDeniedError` -- a 403 confirms the resource exists, which is precisely the
  information the ACL is there to withhold (``DEC-14``).
* :class:`PermissionDeniedError` therefore exists only for the case where existence is already known
  to the caller: they can read the thing and are trying to do something to it they may not.
"""

from __future__ import annotations


class SonariumError(Exception):
    """Base class for every error the application raises deliberately."""

    code = "error"

    def __init__(self, detail: str, *, code: str | None = None) -> None:
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code


class ConfigurationError(SonariumError):
    """The instance is misconfigured. Raised at startup, reported as text, never as a traceback."""

    code = "configuration_error"


class NotFoundError(SonariumError):
    """The resource does not exist, or the caller may not know that it does."""

    code = "not_found"


class UnauthenticatedError(SonariumError):
    """No usable session on the request."""

    code = "unauthenticated"


class PermissionDeniedError(SonariumError):
    """The caller can see the resource but not perform this action on it."""

    code = "permission_denied"


class ConflictError(SonariumError):
    """The request contradicts the current state -- a duplicate slug, a cycle in the tree."""

    code = "conflict"


class InvalidRequestError(SonariumError):
    """The request is well-formed but wrong: an unsupported format, an impossible range."""

    code = "invalid_request"


class ToolError(SonariumError):
    """An external tool (``ffmpeg``, ``ffprobe``) failed, timed out or was not found."""

    code = "tool_error"


class ProviderError(SonariumError):
    """A transcription provider refused, failed or answered something unusable."""

    code = "provider_error"


class ProviderUnreachableError(ProviderError):
    """Nothing answered at all -- no connection, or no reply within the timeout.

    A subclass rather than a flag because the two failures have different remedies and a caller
    that cannot tell them apart reports the wrong one: an address nobody is listening at is fixed
    by correcting the address, and a model that refuses the request is fixed by choosing another.
    Every caller that only cares that something went wrong still catches :class:`ProviderError`.
    """

    code = "provider_unreachable"
