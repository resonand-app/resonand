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
from sonarium.api.routes import (
    admin,
    audio,
    auth,
    health,
    ingest,
    libraries,
    operations,
    search,
    transcription,
)
from sonarium.core.config import Settings, get_settings
from sonarium.db.engine import Database, build_engine
from sonarium.db.migrate import migrate_at_startup
from sonarium.jobs.handlers import Context
from sonarium.jobs.worker import Worker
from sonarium.transcription.registry import build_provider

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

    for router in (
        health.router,
        auth.router,
        libraries.router,
        audio.router,
        ingest.router,
        search.router,
        transcription.router,
        admin.router,
        operations.router,
    ):
        app.include_router(router)

    @app.get("/", tags=["meta"], summary="What this instance is")
    def instance() -> dict[str, Any]:
        """Enough for a client to know what it is talking to, without a session."""
        return {"name": "sonarium", "version": __version__, "status": "ok"}

    return app


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Migrate, start the worker, hand over; then stop the worker.

    Migrating here (``OPS-7``) is what makes the ordinary way to upgrade "pull the image and
    restart" rather than "remember to run a command". The lock is inside
    :func:`~sonarium.db.migrate.migrate_at_startup`, because two containers coming up together
    is an ordinary event.

    The worker runs in this process (``JOB-1``). A test hands the application a database of its
    own, and starting a worker against it would run real ffmpeg during unit tests, so the
    worker starts only when this process owns its database.
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

    owns_database = getattr(app.state, "database", None) is None
    if owns_database:
        before, after = migrate_at_startup(settings)
        if before != after:
            _logger.info("instance.migrated", from_revision=before, to_revision=after)
        # Built from this application's own settings rather than from the process-wide
        # singleton, which reads the environment. In a container the two are identical; in a
        # test they are not, and an application quietly using a different database than the
        # one it was configured with is a bad thing to have available.
        app.state.database = Database(build_engine(settings))

    worker = _start_worker(app, settings) if owns_database and settings.run_worker else None
    try:
        yield
    finally:
        if worker is not None:
            worker.stop()
        if owns_database:
            app.state.database.dispose()
        _logger.info("instance.stopping")


def _start_worker(app: FastAPI, settings: Settings) -> Worker:
    """Start the in-process job worker (``JOB-1``)."""
    provider = build_provider(settings) if settings.transcription_base_url else None
    worker = Worker(
        Context(database=app.state.database, settings=settings, provider=provider),
        concurrency=settings.job_concurrency,
    )
    worker.start()
    app.state.worker = worker
    return worker
