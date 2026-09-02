"""The FastAPI application.

Placeholder from ``INF-1``: it proves the backend starts. ``API-1`` replaces the body of
:func:`create_app` with the real skeleton -- uniform errors, pagination, published OpenAPI -- and
``API-2`` puts the authentication dependency in front of every route.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from sonarium import __version__
from sonarium.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application. Callers pass settings in tests; the entry point does not."""
    resolved = settings or get_settings()
    app = FastAPI(
        title="Sonarium",
        version=__version__,
        root_path=resolved.base_path,
    )

    @app.get("/")
    def root() -> dict[str, Any]:
        return {"name": "sonarium", "version": __version__, "status": "ok"}

    return app
