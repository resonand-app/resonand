"""Liveness and readiness (``OPS-5``).

The distinction matters to whatever is restarting the container: ``/healthz`` says the process is
answering, ``/readyz`` says it can actually serve, which for this application means the database
is reachable and migrated. A container that answers ``/healthz`` while its database is missing
would be restarted forever by an orchestrator watching the wrong one.

Neither requires a session, and neither says anything that would be worth learning without one.
"""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from sonarium.api.deps import ReadSession

router = APIRouter(tags=["operations"], include_in_schema=False)


@router.get("/healthz", summary="Is the process answering")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", summary="Can it serve")
def readyz(session: ReadSession, response: Response) -> dict[str, str]:
    try:
        session.execute(text("SELECT 1 FROM alembic_version LIMIT 1")).first()
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not ready", "reason": "the database is not reachable or not migrated"}
    return {"status": "ready"}
