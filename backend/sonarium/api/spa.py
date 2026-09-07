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
is opened, so ``../../data/sonarium.db`` is the shell and not the database.

When no bundle is present -- a developer running ``uvicorn`` beside ``npm run dev``, or a test --
none of this is installed at all, and ``/`` goes on saying what the instance is.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING

# `Request` is imported at runtime and not under TYPE_CHECKING, and has to be: FastAPI resolves
# the handler's annotations to decide what to inject, and a name that only exists for the type
# checker resolves to nothing -- which it reports as a missing query parameter rather than as
# the import problem it is.
from fastapi import Request
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles

from sonarium.api.namespace import API_PREFIX
from sonarium.core.errors import NotFoundError

if TYPE_CHECKING:
    from os import PathLike
    from pathlib import Path

    from fastapi import FastAPI
    from starlette.responses import Response
    from starlette.types import Scope

ASSETS_PATH = "/assets"
"""Where Vite puts everything it hashes."""

IMMUTABLE = "public, max-age=31536000, immutable"
"""A year, for files whose name changes whenever their content does."""

REVALIDATE = "no-cache"
"""The shell is checked on every navigation, which is how a deployed update arrives without
anybody being told to clear anything."""


class HashedAssets(StaticFiles):
    """``StaticFiles`` that says its contents never change.

    They genuinely do not: Vite puts a hash of the content into the file name, so a changed
    bundle is a different URL. That is what makes the strong header honest here and dangerous
    on anything else, which is why only this one directory is served through it.
    """

    def file_response(
        self,
        full_path: PathLike[str] | str,
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        response.headers["cache-control"] = IMMUTABLE
        return response


@dataclass(frozen=True, slots=True)
class SinglePageApp:
    """A built interface on disk, ready to be served."""

    root: Path
    index: Path

    @classmethod
    def discover(cls, settings_static_dir: Path) -> SinglePageApp | None:
        """Find the built interface, or report that this instance has none.

        Presence of ``index.html`` is the test rather than presence of the directory: the image
        creates ``/app`` early, and an empty directory mistaken for a bundle fails later and
        less clearly than not finding one at all.
        """
        index = settings_static_dir / "index.html"
        if not index.is_file():
            return None
        return cls(root=settings_static_dir.resolve(), index=index.resolve())

    def install(self, app: FastAPI) -> None:
        """Put the bundle on the network. Call this after every router is included."""
        assets = self.root / "assets"
        if assets.is_dir():
            app.mount(ASSETS_PATH, HashedAssets(directory=assets), name="assets")

        @app.get("/{requested:path}", include_in_schema=False)
        def shell(requested: str, request: Request) -> FileResponse:
            """Serve a file the bundle holds, or the shell, or the ordinary 404."""
            held = self.file_within(requested)
            if held is not None:
                return FileResponse(held)
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
            return FileResponse(self.index, headers={"cache-control": REVALIDATE})

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


def install_spa(app: FastAPI, static_dir: Path) -> SinglePageApp | None:
    """Install the built interface if this instance has one. Returns what was installed."""
    spa = SinglePageApp.discover(static_dir)
    if spa is not None:
        spa.install(app)
    return spa
