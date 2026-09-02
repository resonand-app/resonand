"""The FastAPI application (``API-1``).

The web interface is one client of this API among others (principle 4), so the skeleton is built
for a documented HTTP surface rather than for whatever the interface happens to need: uniform
errors, one pagination envelope, and an OpenAPI document good enough to generate a typed client
from -- which is exactly what ``UI-3`` does, and what keeps the interface a client of the API
rather than a privileged path into it.

``API-2`` puts the authentication dependency in front of every route, and the routers themselves
arrive with their tracks. What this module owns is that no endpoint invents its own error shape,
its own paging or its own logging.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

import structlog
from fastapi import FastAPI

from sonarium import __version__
from sonarium.api.errors import install_error_handlers
from sonarium.api.logging import RequestCorrelationMiddleware, configure_logging
from sonarium.api.rate_limit import AttemptLimiter
from sonarium.api.routes import admin, audio, auth, health, libraries
from sonarium.core.config import Settings, get_settings

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

DESCRIPTION = """\
A self-hosted archive for the recordings that matter.

Public identifiers are `uuid`s; integer ids are internal. Anything you may not read answers
**404**, never 403 -- a 403 would confirm the resource exists.
"""

_logger = structlog.get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application.

    Tests pass settings in; the container's entry point does not, and reads them from the
    environment instead (``OPS-3``).
    """
    resolved = settings or get_settings()
    configure_logging(resolved)

    app = FastAPI(
        title="Sonarium",
        version=__version__,
        description=DESCRIPTION,
        summary="A self-hosted archive for the recordings that matter.",
        license_info={"name": "AGPL-3.0-only", "url": "https://www.gnu.org/licenses/agpl-3.0.html"},
        root_path=resolved.base_path,
        lifespan=_lifespan,
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url=None,
    )
    app.state.settings = resolved
    app.state.login_limiter = AttemptLimiter(resolved.login_attempts_per_minute)

    app.add_middleware(RequestCorrelationMiddleware)
    install_error_handlers(app)

    for router in (health.router, auth.router, libraries.router, audio.router, admin.router):
        app.include_router(router)

    @app.get("/", tags=["meta"], summary="What this instance is")
    def instance() -> dict[str, Any]:
        """Enough for a client to know what it is talking to, without a session."""
        return {"name": "sonarium", "version": __version__, "status": "ok"}

    return app


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Prepare the instance, then hand over.

    Migrations at startup are ``OPS-7`` and belong here, behind a lock, once ``DAT-1`` has landed;
    the job worker (``JOB-1``) starts and stops here too. Both are deliberately absent rather than
    stubbed.
    """
    settings: Settings = app.state.settings
    settings.prepare_directories()
    _logger.info(
        "instance.starting",
        version=__version__,
        base_path=settings.base_path or "/",
        database=str(settings.resolved_database_path),
        storage=str(settings.resolved_storage_dir),
    )
    yield
    _logger.info("instance.stopping")
