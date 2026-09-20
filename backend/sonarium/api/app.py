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
from sonarium.api.headers import SecurityHeaders
from sonarium.api.limits import RequestSizeLimit
from sonarium.api.logging import RequestCorrelationMiddleware, configure_logging
from sonarium.api.namespace import API_PREFIX
from sonarium.api.rate_limit import AttemptLimiter
from sonarium.api.routes import (
    admin,
    audio,
    auth,
    events,
    health,
    ingest,
    libraries,
    operations,
    search,
    transcription,
    users,
)
from sonarium.api.spa import inline_script_hashes, install_spa
from sonarium.core.changes import Changes
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


def _refuse_an_instance_that_cannot_run(settings: Settings) -> None:
    """Say what is missing and stop, rather than starting and failing later on a real request.

    ``SystemExit`` rather than an exception: uvicorn imports this factory, so anything raised here
    reaches an operator as a traceback whose last line is the message -- and
    ``ConfigurationError`` exists to be reported as text and never as that. One event per problem
    because the default renderer is JSON, where a multi-line message is a wall of ``\n``.
    """
    report = settings.configuration_problems()
    for problem in report.fatal:
        _logger.error("configuration.refused", problem=problem)
    for advisory in report.advisory:
        _logger.warning("configuration.incomplete", detail=advisory)
    if report.fatal:
        raise SystemExit(1)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application.

    Tests pass settings in; the container's entry point does not, and reads them from the
    environment instead (``OPS-3``) -- which is the branch that is checked, because it is the
    only one where a person wrote the configuration and can still be told what is wrong with it.
    """
    resolved = settings or get_settings()
    configure_logging(resolved)
    if settings is None:
        _refuse_an_instance_that_cannot_run(resolved)

    app = FastAPI(
        title="Sonarium",
        version=__version__,
        description=DESCRIPTION,
        summary="A self-hosted archive for the recordings that matter.",
        license_info={"name": "AGPL-3.0-only", "url": "https://www.gnu.org/licenses/agpl-3.0.html"},
        root_path=resolved.base_path,
        lifespan=_lifespan,
        openapi_url=f"{API_PREFIX}/openapi.json",
        docs_url=f"{API_PREFIX}/docs",
        # Named rather than defaulted: it is the one path FastAPI keeps at the root when the
        # viewer moves, and a page of the interface could be given the same name tomorrow.
        swagger_ui_oauth2_redirect_url=f"{API_PREFIX}/docs/oauth2-redirect",
        redoc_url=None,
    )
    app.state.settings = resolved
    # One per application rather than per module, so that two instances in one process -- which
    # is what a test suite is -- cannot reach each other's subscribers.
    app.state.changes = Changes()
    app.state.login_limiter = AttemptLimiter(resolved.login_attempts_per_minute)
    app.state.login_client_limiter = AttemptLimiter(resolved.login_attempts_per_client_per_minute)

    # Added innermost first: `add_middleware` stacks in reverse, so the last one added is the
    # outermost. Correlation is outermost because a refused request still deserves an id in its
    # answer and a line in the log, and the size ceiling is inside it because it has to run
    # before anything reads a body -- including the dependency that authenticates the caller.
    app.add_middleware(
        RequestSizeLimit,
        upload_bytes=resolved.max_upload_bytes,
        body_bytes=resolved.max_request_bytes,
    )
    # Outside the size ceiling, so that a refused body is answered with the headers too. The
    # hashes come off the built shell rather than being written down, so editing `index.html`
    # cannot leave a policy behind that refuses the page it describes.
    app.add_middleware(SecurityHeaders, script_hashes=inline_script_hashes(resolved.static_dir))
    app.add_middleware(RequestCorrelationMiddleware)
    install_error_handlers(app)

    app.include_router(health.router)
    for router in (
        auth.router,
        libraries.router,
        libraries.trash_router,
        audio.router,
        ingest.router,
        events.router,
        search.router,
        transcription.router,
        users.router,
        admin.router,
        operations.router,
    ):
        app.include_router(router, prefix=API_PREFIX)

    # After every router, and that ordering is the whole design (``INF-3e``): the shell is a
    # fallback, so a path that is an endpoint stays an endpoint and there is no list of API
    # prefixes anywhere that could go stale. Since ``API-16`` the two namespaces are disjoint by
    # construction as well as by ordering. When the image carries no bundle -- a developer, a
    # test -- nothing is installed and the root keeps answering below.
    app.state.spa = install_spa(app, resolved.static_dir, resolved.base_path)

    if app.state.spa is None:

        @app.get("/", tags=["meta"], summary="What this instance is", include_in_schema=False)
        def instance() -> dict[str, Any]:
            """Enough for a client to know what it is talking to, without a session.

            The root belongs to whoever is being served there. With a bundle present it is the
            interface; without one it is this. ``GET /api/instance`` is the answer that never
            moves, which is why it is the one the interface is written against.

            Out of the published document deliberately: whether this route exists at all depends
            on whether the image being described carries a bundle, and a document that changes
            shape with the filesystem is one ``UI-3a`` cannot commit a snapshot of.
            """
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
        worker="in-process" if settings.run_worker else "off",
    )

    owns_database = getattr(app.state, "database", None) is None
    if owns_database and not settings.run_worker:
        # The only configuration from which somebody reaches a second writer, so it is the only
        # one worth a warning (``REV-8``).
        _logger.warning(
            "instance.worker_disabled",
            database=str(settings.resolved_database_path),
            note=(
                "no jobs will run in this process, and a second process writing this database "
                "is not a supported topology"
            ),
        )
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
        Context(
            database=app.state.database,
            settings=settings,
            provider=provider,
            changes=app.state.changes,
        ),
        concurrency=settings.job_concurrency,
    )
    worker.start()
    app.state.worker = worker
    return worker
