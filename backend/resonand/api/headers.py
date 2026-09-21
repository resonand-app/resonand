"""The headers a browser needs in order to defend the page for you (``SEC-4``).

Resonand serves its own interface, its own API and its own users' audio from one origin, and it
was sending none of these. Three of them are doing real work here rather than being on a list:

**``frame-ancestors``.** The irreversible actions in this product -- purge a recording, purge a
library -- are a confirmation dialog away, and a confirmation dialog in an invisible iframe is
the oldest trick there is. Nothing here is ever meant to be framed.

**``nosniff``.** The streaming endpoint serves bytes somebody uploaded, under a type guessed from
the file extension they chose. Sniffing is the browser deciding it knows better, and the one case
where it is right is not worth the case where it decides an audio file is a document.

**The script policy.** The shell's one inline script is named by hash rather than allowed
wholesale (see :func:`~resonand.api.spa.inline_script_hashes`), so a policy stays a policy: no
injected ``<script>`` runs, and nothing can reach an origin this instance is not.

``style-src`` keeps ``'unsafe-inline'`` and that is a genuine hole rather than an oversight. The
interface styles elements through React's ``style`` prop in enough places that removing it is a
frontend change rather than a header change, and a policy that broke the page would be removed by
whoever hit it first. It is the one relaxation, it is written down here, and it does not let
anybody run script.

**The documentation viewer is exempt from the script and style rules.** It is FastAPI's page, not
this project's, and it loads Swagger from a CDN and boots it inline. Every other header still
applies to it, ``frame-ancestors`` included.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from resonand.api.namespace import API_PREFIX

if TYPE_CHECKING:
    from collections.abc import Sequence

    from starlette.types import ASGIApp, Message, Receive, Scope, Send

DOCS_PATH = f"{API_PREFIX}/docs"

_SWAGGER_CDN = "https://cdn.jsdelivr.net"
_SWAGGER_ICON = "https://fastapi.tiangolo.com"

BASE_HEADERS: tuple[tuple[bytes, bytes], ...] = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"same-origin"),
    # Superseded by `frame-ancestors` in every browser that reads a policy at all, and one header
    # long for the ones that do not.
    (b"x-frame-options", b"DENY"),
    (b"cross-origin-opener-policy", b"same-origin"),
)

_SHARED_POLICY = (
    "default-src 'self'",
    # `'self'` and not `'none'`, because the shell carries a `<base href>` and `'none'` makes the
    # browser drop it silently -- which serves a page whose every relative asset resolves against
    # the current route (`OPS-4`). What the directive is for survives: an injected base can name
    # this origin and nothing else, and this origin serves the bundle and audio under `nosniff`,
    # so there is nowhere on it to point a relative script at.
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "connect-src 'self'",
    "font-src 'self'",
    "media-src 'self'",
)


def content_policy(script_hashes: Sequence[str] = ()) -> str:
    """The policy for the interface and the API."""
    script = " ".join(("'self'", *script_hashes))
    return "; ".join(
        (
            *_SHARED_POLICY,
            "img-src 'self' data:",
            f"script-src {script}",
            "style-src 'self' 'unsafe-inline'",
        )
    )


def docs_policy() -> str:
    """The policy for FastAPI's own viewer, which is somebody else's page on our origin."""
    return "; ".join(
        (
            "default-src 'self'",
            "base-uri 'none'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "object-src 'none'",
            "connect-src 'self'",
            f"img-src 'self' data: {_SWAGGER_ICON}",
            f"script-src 'self' 'unsafe-inline' {_SWAGGER_CDN}",
            f"style-src 'self' 'unsafe-inline' {_SWAGGER_CDN}",
            f"font-src 'self' {_SWAGGER_CDN}",
        )
    )


class SecurityHeaders:
    """Add the headers to every response, without touching the body.

    Raw ASGI rather than ``BaseHTTPMiddleware`` for the reason every middleware in this package
    is: the streaming endpoint serves ``Range`` responses out of a file, and buffering those is
    how a seek in a two-hour recording becomes a stall.
    """

    def __init__(self, app: ASGIApp, *, script_hashes: Sequence[str] = ()) -> None:
        self.app = app
        self._policy = content_policy(script_hashes).encode()
        self._docs_policy = docs_policy().encode()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        policy = self._docs_policy if _is_docs(scope) else self._policy

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {name.lower() for name, _ in headers}
                for name, value in BASE_HEADERS:
                    if name not in present:
                        headers.append((name, value))
                if b"content-security-policy" not in present:
                    headers.append((b"content-security-policy", policy))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_with_headers)


def _is_docs(scope: Scope) -> bool:
    """Whether this is the documentation viewer rather than the product.

    Matched on the path the application sees, so an instance on a subpath is matched the same way:
    ``root_path`` is stripped before the route is resolved and before this runs.
    """
    path = str(scope.get("path", ""))
    return path == DOCS_PATH or path.startswith(f"{DOCS_PATH}/")
