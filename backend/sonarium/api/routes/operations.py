"""What an administrator needs to see (``INT-3``, ``OPS-5``).

Three questions, and the third is the one that is usually unanswerable in self-hosted software:
*is the background work getting done*, *is the archive the size I think it is*, and *is the
schema the one this image expects*. The last one is what turns a bad upgrade from a mystery into
a decision.

**Nothing here reaches out to a third party on its own.** The transcription provider's status is
reported from configuration, and its reachability is ``null`` until somebody explicitly asks for a
connection test. Principle 2 is that audio does not leave unless asked; a page that quietly
contacted a provider to draw a green dot would be a smaller version of the same violation.
"""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from sonarium import __version__
from sonarium.api.deps import InstanceSettings, ReadSession, WriteSession, current_admin
from sonarium.api.pagination import Page, PageRequest, page_of, page_request
from sonarium.api.schemas import (
    JobSummary,
    ProviderStatus,
    StorageStatus,
    SystemStatus,
)
from sonarium.core.config import Settings
from sonarium.core.errors import NotFoundError
from sonarium.db.engine import build_engine
from sonarium.db.migrate import revisions
from sonarium.db.models import Audio, Job, Library
from sonarium.jobs import queue

router = APIRouter(prefix="/admin", tags=["administration"], dependencies=[Depends(current_admin)])

Paging = Annotated[PageRequest, Depends(page_request)]

CONNECTION_TEST_TIMEOUT = 10.0


@router.get("/jobs", response_model=Page[JobSummary], summary="The job queue")
def list_jobs(
    session: ReadSession,
    paging: Paging,
    state: str | None = None,
) -> Page[JobSummary]:
    """Pending, running, done, failed and cancelled work, newest first.

    Newest first rather than oldest, because the reason somebody opens this page is that
    something has just gone wrong.
    """
    query = select(Job, Audio.uuid).join(Audio, Audio.id == Job.audio_id, isouter=True)
    if state:
        query = query.where(Job.state == state)
    total = int(
        session.execute(
            select(func.count(Job.id)).where(Job.state == state)
            if state
            else select(func.count(Job.id))
        ).scalar_one()
    )
    rows = session.execute(
        query.order_by(Job.id.desc()).limit(paging.limit).offset(paging.offset)
    ).all()
    return page_of(
        [
            JobSummary(
                id=job.id,
                kind=job.kind,
                state=job.state,
                attempts=job.attempts,
                audio_uuid=audio_uuid,
                error=job.error,
                created_at=job.created_at,
                started_at=job.started_at,
                finished_at=job.finished_at,
                ready_at=queue.ready_at(job) if job.state == queue.PENDING else None,
            )
            for job, audio_uuid in rows
        ],
        total=total,
        request=paging,
    )


@router.post("/jobs/{job_id}/retry", summary="Try a failed job again")
def retry_job(job_id: int, session: WriteSession) -> dict[str, str]:
    """Put a failed or cancelled job back on the queue, with its attempts reset.

    Resetting is deliberate: somebody clicking retry has usually just fixed the thing that broke.
    """
    if not queue.retry(session, job_id):
        raise NotFoundError("There is no failed or cancelled job with that id.")
    return {"state": queue.PENDING}


@router.post("/jobs/{job_id}/cancel", summary="Give up on a job")
def cancel_job(job_id: int, session: WriteSession) -> dict[str, str]:
    """Cancel work that has not finished. A job already in flight is not interrupted."""
    if not queue.cancel(session, job_id):
        raise NotFoundError("There is no unfinished job with that id.")
    return {"state": queue.CANCELLED}


@router.get("/transcription", response_model=ProviderStatus, summary="Transcription settings")
def transcription_status(settings: InstanceSettings) -> ProviderStatus:
    """Reported from configuration alone. Nothing is contacted."""
    return _provider_status(settings)


@router.post("/transcription/test", response_model=ProviderStatus, summary="Test the connection")
def test_transcription(settings: InstanceSettings) -> ProviderStatus:
    """Ask the transcription service whether it is there.

    An explicit action, on a button, because contacting a third party is not something a page
    should do because it was opened. No audio is sent -- this asks for the model list, which is
    the cheapest thing an OpenAI-compatible server will answer.
    """
    status = _provider_status(settings)
    if not status.configured or settings.transcription_base_url is None:
        return status
    url = f"{settings.transcription_base_url.rstrip('/')}/models"
    headers = {}
    if settings.transcription_api_key is not None:
        headers["Authorization"] = f"Bearer {settings.transcription_api_key.get_secret_value()}"
    try:
        response = httpx.get(url, headers=headers, timeout=CONNECTION_TEST_TIMEOUT)
    except httpx.ConnectError:
        return status.model_copy(
            update={
                "reachable": False,
                "detail": f"Nothing answered at {url}. Check that the service is running and "
                "that the address is right.",
            }
        )
    except httpx.TimeoutException:
        return status.model_copy(
            update={
                "reachable": False,
                "detail": f"{url} did not answer within {CONNECTION_TEST_TIMEOUT:.0f}s.",
            }
        )
    if response.is_success:
        return status.model_copy(
            update={"reachable": True, "detail": "The transcription service answered."}
        )
    return status.model_copy(
        update={
            "reachable": False,
            "detail": f"The transcription service answered {response.status_code}. "
            "A 401 means the key is wrong; a 404 usually means the address is missing /v1.",
        }
    )


@router.get("/status", response_model=SystemStatus, summary="The state of this instance")
def system_status(session: ReadSession, settings: InstanceSettings) -> SystemStatus:
    """Space, counts, queue, schema revision.

    The pair of revisions is the load-bearing part: it says whether to roll the image back or the
    database forward, which is the question an operator has at the worst possible moment.
    """
    engine = build_engine(settings)
    try:
        current, head = revisions(engine)
    finally:
        engine.dispose()
    return SystemStatus(
        version=__version__,
        database_revision=current,
        expected_revision=head,
        storage=_storage_status(session, settings),
        jobs=queue.counts(session),
        transcription=_provider_status(settings),
        trash_retention_days=settings.trash_retention_days,
    )


def _provider_status(settings: Settings) -> ProviderStatus:
    configured = bool(settings.transcription_base_url)
    return ProviderStatus(
        provider=settings.transcription_provider,
        model=settings.transcription_model,
        base_url=settings.transcription_base_url,
        has_credential=settings.transcription_api_key is not None,
        default_language=settings.transcription_language,
        configured=configured,
        reachable=None,
        detail=(
            "Configured. Run a connection test to check it answers."
            if configured
            else "No transcription service is configured, so nothing can be transcribed. Set "
            "SONARIUM_TRANSCRIPTION_BASE_URL."
        ),
    )


def _storage_status(session: ReadSession, settings: Settings) -> StorageStatus:
    live = session.execute(
        select(func.count(Audio.id), func.coalesce(func.sum(Audio.duration_ms), 0)).where(
            Audio.deleted_at.is_(None)
        )
    ).one()
    trashed = int(
        session.execute(
            select(func.count(Audio.id)).where(Audio.deleted_at.is_not(None))
        ).scalar_one()
    )
    libraries = int(
        session.execute(
            select(func.count(Library.id)).where(Library.deleted_at.is_(None))
        ).scalar_one()
    )
    originals, derived = _measure(settings.resolved_storage_dir)
    database = settings.resolved_database_path
    return StorageStatus(
        recordings=int(live[0]),
        trashed_recordings=trashed,
        libraries=libraries,
        total_duration_ms=int(live[1]),
        originals_bytes=originals,
        derived_bytes=derived,
        database_bytes=database.stat().st_size if database.exists() else 0,
        free_bytes=_free_space(settings.data_dir),
    )


def _measure(storage_root: Path) -> tuple[int, int]:
    """Originals and derivatives, counted apart.

    Worth separating: the derivatives are regenerable and the originals are not, so an
    administrator looking at a nearly full disk needs to know which half is which before deciding
    what to do about it.
    """
    originals = derived = 0
    if not storage_root.exists():
        return 0, 0
    for path in storage_root.glob("*/*/*"):
        if not path.is_file():
            continue
        size = path.stat().st_size
        if path.name.startswith("original."):
            originals += size
        else:
            derived += size
    return originals, derived


def _free_space(directory: Path) -> int | None:
    try:
        return shutil.disk_usage(directory).free
    except OSError:  # pragma: no cover -- a path that has gone while being measured
        return None
