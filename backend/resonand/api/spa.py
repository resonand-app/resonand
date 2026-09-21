"""Serving the built interface (``INF-3e``).

The image is one container: the API and the web interface come out of the same build and are
reached on the same origin, which is what lets the session cookie be ``SameSite`` and lets the
interface make relative requests with no configured origin anywhere. The bundle Vite writes to
``frontend/dist/`` is copied to ``/app/static``, and this module is what puts it on the network.

Three things it is careful about.

**The API owns its own paths.** The shell is a fallback registered after every router, so a path
that is an endpoint is an endpoint and nothing here can shadow one by accident. There is no list
of API prefixes to keep in step -- the router table is the list. Since ``API-16`` there is also
nothing to shadow: the whole documented surface is under ``/api`` and the interface owns
everything else, so the two namespaces are disjoint by construction rather than by ordering.

**An unknown path answers differently depending on who asked.** A browser navigating to
``/library/<uuid>`` has to receive the shell, because the route is the client's and the server
has never heard of it. A client asking for JSON has to receive the ordinary 404 in the ordinary
envelope, because inventing a 200 for it would turn every typo into a silent success. The
``Accept`` header is what separates them, and it is the only thing that can -- **except under**
``/api``, where a mistyped endpoint is a mistyped endpoint whoever asked. Serving the shell there
would hand a browser a 200 and a page for a call the API does not have, which is the one place
the ``Accept`` rule produces the wrong answer.

**A path is not a file name.** Everything is resolved and checked to be inside the root before it
is opened, so ``../../data/resonand.db`` is the shell and not the database.

**The shell says where it is being served from.** The bundle is built with a relative base, so
every URL in it -- the hashed assets, the icons, the manifest -- resolves against the document's
base URL rather than against the domain root. That base is a fact of the deployment and not of the
build (``OPS-4``), so it is written here, into the one ``<base href>`` the shell carries, as the
shell is served. Nothing else in the document is touched: the theme bootstrap has to hash to what
the content policy already names (``SEC-4``), and a rewrite that reached it would fail as a blank
page with nothing in the log.

When no bundle is present -- a developer running ``uvicorn`` beside ``npm run dev``, or a test --
none of this is installed at all, and ``/`` goes on saying what the instance is.
"""

from __future__ import annotations

import base64
import re
from dataclasses import dataclass
from hashlib import sha256
from typing import TYPE_CHECKING

# `Request` is imported at runtime and not under TYPE_CHECKING, and has to be: FastAPI resolves
# the handler's annotations to decide what to inject, and a name that only exists for the type
# checker resolves to nothing -- which it reports as a missing query parameter rather than as
# the import problem it is.
import structlog
from fastapi import Request
from starlette.responses import FileResponse, Response

from resonand.api.namespace import API_PREFIX
from resonand.core.errors import NotFoundError

if TYPE_CHECKING:
    from pathlib import Path

    from fastapi import FastAPI

_logger = structlog.get_logger(__name__)

ASSETS_DIR = "assets"
"""Where Vite puts everything it hashes."""

IMMUTABLE = "public, max-age=31536000, immutable"
"""A year, for files whose name changes whenever their content does."""

REVALIDATE = "no-cache"
"""Checked on every navigation, which is how a deployed update arrives without anybody being
told to clear anything. Everything the bundle holds that is *not* hashed takes this too -- the
icons and the manifest keep their names across versions, so a year of caching would pin them."""


@dataclass(frozen=True, slots=True)
class SinglePageApp:
    """A built interface on disk, ready to be served."""

    root: Path
    index: Path
    shell: bytes
    """The served shell: ``index.html`` with its base href pointing at the deployment root.

    Held rather than re-read, because it is answered on every navigation and the rewrite is the
    same every time. The bundle is part of the image, so the only way for this copy to go stale
    is to replace the files under a running process -- which is not how a container is updated.
    """

    @classmethod
    def discover(cls, settings_static_dir: Path, base_path: str = "") -> SinglePageApp | None:
        """Find the built interface, or report that this instance has none.

        Presence of ``index.html`` is the test rather than presence of the directory: the image
        creates ``/app`` early, and an empty directory mistaken for a bundle fails later and
        less clearly than not finding one at all.
        """
        index = settings_static_dir / "index.html"
        if not index.is_file():
            return None
        return cls(
            root=settings_static_dir.resolve(),
            index=index.resolve(),
            shell=rebase(index.read_bytes(), base_path),
        )

    def install(self, app: FastAPI) -> None:
        """Put the bundle on the network. Call this after every router is included.

        One route and no mount, which is a decision (``OPS-4``). A mount accumulates its own
        prefix onto the request's ``root_path``, and behind a proxy that strips the deployment
        prefix the two do not add up -- ``/assets/index-abc.js`` arrives with ``root_path`` set
        to ``/resonand`` and is looked for inside ``static/assets/assets/``. Ordinary routes are
        resolved against the path as it arrived and are indifferent to which way the proxy was
        configured, so every file the bundle holds is served the same way and the arrangement
        ``deploy/README.md`` offers second stops being the broken one.
        """

        @app.get("/{requested:path}", include_in_schema=False)
        def shell(requested: str, request: Request) -> Response:
            """Serve a file the bundle holds, or the shell, or the ordinary 404."""
            held = self.file_within(requested)
            if held is not None:
                return FileResponse(held, headers={"cache-control": self.caching(held)})
            if within_the_api(requested):
                raise NotFoundError(
                    "There is no such endpoint. The API is served under "
                    f"{API_PREFIX}, and the interface is not."
                )
            if not wants_html(request):
                raise NotFoundError(
                    "There is no such endpoint. The interface is served from this same origin, "
                    "so a request that accepted HTML would have been given the application "
                    "shell instead."
                )
            return Response(
                content=self.shell,
                media_type="text/html; charset=utf-8",
                headers={"cache-control": REVALIDATE},
            )

    def caching(self, held: Path) -> str:
        """How long this file may be kept.

        Hard and long for anything under ``assets/``, because Vite puts a hash of the content
        into the name there and a changed file is therefore a different URL. That is what makes
        the strong header honest in one directory and dangerous everywhere else.
        """
        return IMMUTABLE if held.is_relative_to(self.root / ASSETS_DIR) else REVALIDATE

    def file_within(self, requested: str) -> Path | None:
        """The real file this path names, if the bundle holds one and it is really inside it."""
        if not requested:
            return None
        candidate = (self.root / requested).resolve()
        if not candidate.is_relative_to(self.root):
            return None
        if not candidate.is_file():
            return None
        return candidate


def within_the_api(requested: str) -> bool:
    """Whether this path belongs to the API's namespace rather than the interface's.

    It reached the fallback, so it is not an endpoint -- but under ``/api`` that means a mistyped
    endpoint and not a client route, and the answer is the ordinary 404 whoever asked.
    """
    prefix = API_PREFIX.strip("/")
    return requested == prefix or requested.startswith(f"{prefix}/")


def wants_html(request: Request) -> bool:
    """Whether this is a browser navigating rather than a client fetching.

    Deliberately literal: ``*/*`` -- what curl and every generated client send -- is not HTML.
    A browser navigation names ``text/html`` explicitly.
    """
    return "text/html" in request.headers.get("accept", "")


def install_spa(app: FastAPI, static_dir: Path, base_path: str = "") -> SinglePageApp | None:
    """Install the built interface if this instance has one. Returns what was installed."""
    spa = SinglePageApp.discover(static_dir, base_path)
    if spa is not None:
        spa.install(app)
    return spa


_BASE_HREF = re.compile(rb"(<base\s[^>]*?\bhref=\")[^\"]*(\")", re.IGNORECASE)


def rebase(shell: bytes, base_path: str) -> bytes:
    """Point the shell's base href at the deployment root.

    One attribute of one element, matched rather than templated, so that everything else in the
    document -- and the theme bootstrap above all -- comes out byte for byte as it was built
    (``SEC-4``).

    A trailing slash, always: ``<base href="/resonand">`` resolves ``./assets/x.js`` to
    ``/assets/x.js``, because a base URL without one names a file and the last segment is
    dropped. That is the failure this whole task exists to stop happening in somebody else's
    deployment, and it is one character.
    """
    href = f"{base_path}/".encode()
    rewritten, replaced = _BASE_HREF.subn(rb"\g<1>" + href + rb"\g<2>", shell, count=1)
    if replaced == 0 and base_path:
        # Only reachable by serving a bundle built before the base element existed, which one
        # image cannot do. Said rather than raised: an instance that answers with a shell whose
        # assets 404 is still an instance somebody can read this out of.
        _logger.warning("spa.no_base_element", base_path=base_path)
    return rewritten


_INLINE_SCRIPT = re.compile(
    rb"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE
)


def inline_script_hashes(static_dir: Path) -> tuple[str, ...]:
    """The ``sha256-`` sources a content policy needs in order to allow this shell's own scripts.

    The shell carries exactly one inline script: the theme bootstrap, which has to run before any
    module does so that somebody who chose light does not watch a dark page repaint (``UI-1j``).
    It cannot move into the bundle without bringing back the flash it exists to prevent, so the
    policy names it by hash rather than allowing inline script wholesale -- which would give up
    most of what the policy is for (``SEC-4``).

    Read out of the built shell rather than written down here, so editing ``index.html`` cannot
    leave behind a policy that refuses it. An instance with no bundle has no inline script and
    gets an empty tuple, which is the strictest answer rather than a missing one.
    """
    index = static_dir / "index.html"
    if not index.is_file():
        return ()
    return script_hashes_of(index.read_bytes())


def script_hashes_of(shell: bytes) -> tuple[str, ...]:
    """The same, for a shell already in hand -- which is how the rewrite is checked against it."""
    return tuple(
        f"'sha256-{base64.b64encode(sha256(body).digest()).decode()}'"
        for body in _INLINE_SCRIPT.findall(shell)
        if body.strip()
    )
