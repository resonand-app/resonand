"""The job table, and the rules for taking work off it (``JOB-1``).

Four things happen to a recording after it arrives -- probe, waveform, transcode, transcribe --
and none of them may happen inside the request that uploaded it. An hour of driving takes minutes
to transcode and can take much longer to transcribe; a browser will not wait, and a request that
holds the write lock while ffmpeg runs would stop the whole archive.

**Backoff is derived, not stored.** A failed job goes back to ``pending`` with its ``finished_at``
left where it is, and a claim skips any pending job whose last failure is more recent than its
backoff allows. That is worth a sentence because the obvious alternative -- a ``run_after``
column -- is a schema change, and this needs none: the two columns that would feed it are already
there and already mean the right thing.

**Every claim is one serialised write.** Two workers cannot take the same job, because taking one
is an ``UPDATE ... WHERE state = 'pending'`` guarded by the same lock as every other write.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from sonarium.core.time import instant_after, now_instant, parse_instant, utc_now
from sonarium.db.engine import changed_rows
from sonarium.db.models import Job

PENDING = "pending"
RUNNING = "running"
DONE = "done"
FAILED = "failed"
CANCELLED = "cancelled"

KIND_PROBE = "probe"
KIND_WAVEFORM = "waveform"
KIND_TRANSCODE = "transcode"
KIND_TRANSCRIBE = "transcribe"

MAX_ATTEMPTS = 5
BASE_BACKOFF_SECONDS = 15
MAX_BACKOFF_SECONDS = 3600


@dataclass(frozen=True, slots=True)
class Work:
    """One claimed job, detached from the session that claimed it.

    A plain value rather than an ORM row on purpose: the handler runs for minutes, outside any
    transaction, and holding a live row across that is how a session ends up used from two
    threads.
    """

    id: int
    kind: str
    audio_id: int | None
    attempts: int
    payload: dict[str, Any]
    external_id: str | None


def backoff_seconds(attempts: int) -> int:
    """How long to wait after ``attempts`` failures.

    Exponential and capped. The cap matters more than the curve: a transcription service that is
    down for a day should be retried hourly, not once more in a fortnight.
    """
    return min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * int(2 ** max(0, attempts - 1)))


def enqueue(
    session: Session,
    kind: str,
    *,
    audio_id: int | None = None,
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> Job | None:
    """Add work, or recognise that it is already there.

    Returns ``None`` when the key is already queued, which is not a failure: it is the whole point
    of the key. A retried upload, a re-run of the watch folder and a second click on "transcribe"
    all arrive here, and only one of them should cost anything.
    """
    if idempotency_key is not None:
        existing = session.execute(
            select(Job).where(Job.idempotency_key == idempotency_key)
        ).scalar_one_or_none()
        if existing is not None:
            return None
    job = Job(
        kind=kind,
        audio_id=audio_id,
        state=PENDING,
        attempts=0,
        idempotency_key=idempotency_key,
        payload=json.dumps(payload or {}),
        created_at=now_instant(),
    )
    session.add(job)
    try:
        with session.begin_nested():
            session.flush()
    except IntegrityError:
        return None
    return job


def transcription_in_flight(session: Session, audio_id: int) -> Job | None:
    """The transcribe job already queued or running for a recording, if there is one.

    ``pending`` counts as in flight: a job waiting on its backoff is one that is going to run.
    """
    return (
        session.execute(
            select(Job)
            .where(
                Job.audio_id == audio_id,
                Job.kind == KIND_TRANSCRIBE,
                Job.state.in_((PENDING, RUNNING)),
            )
            .order_by(Job.id.desc())
        )
        .scalars()
        .first()
    )


def latest_transcription(session: Session, audio_id: int) -> Job | None:
    """The most recent transcribe job for a recording, whatever became of it (``API-17``).

    Different question from :func:`transcription_in_flight`, which answers "would a second
    request queue a duplicate". This one answers "what is there to say about the transcription
    on this screen": the running job while it runs, and the failure once it has failed, because
    ``UI-15c`` shows the real error and there is nowhere else it exists.
    """
    return (
        session.execute(
            select(Job)
            .where(Job.audio_id == audio_id, Job.kind == KIND_TRANSCRIBE)
            .order_by(Job.id.desc())
        )
        .scalars()
        .first()
    )


def enqueue_transcription(
    session: Session, *, audio_id: int, audio_uuid: str, language: str | None = None
) -> Job | None:
    """Ask for a recording to be transcribed, unless it already is being (``API-11``).

    Returns ``None`` when one is already pending or running, which the endpoint answers 409 to.

    **The key is per attempt, not per recording.** It was ``transcribe:{uuid}``, which is
    permanent, so once a recording had been transcribed at upload every later request would find
    the key taken and be discarded silently -- no second job, no conflict, no way to tell. What
    prevents a double click costing two transcriptions is now the check above, which is a
    decision rather than a collision, and the key is left to do what it is for: stopping a retried
    request that arrives twice from queueing twice.
    """
    if transcription_in_flight(session, audio_id) is not None:
        return None
    attempted = int(
        session.execute(
            select(func.count(Job.id)).where(Job.audio_id == audio_id, Job.kind == KIND_TRANSCRIBE)
        ).scalar_one()
    )
    return enqueue(
        session,
        KIND_TRANSCRIBE,
        audio_id=audio_id,
        payload={"language": language} if language else {},
        idempotency_key=f"transcribe:{audio_uuid}:{attempted + 1}",
    )


def claim(session: Session, *, kinds: tuple[str, ...] | None = None) -> Work | None:
    """Take the oldest job that is ready to run, or return ``None``.

    The readiness rule and the state change are one write, so two workers racing for the last job
    cannot both get it.
    """
    query = select(Job).where(Job.state == PENDING).order_by(Job.created_at, Job.id)
    if kinds:
        query = query.where(Job.kind.in_(kinds))
    for job in session.execute(query).scalars().all():
        if not _is_ready(job):
            continue
        changed = session.execute(
            update(Job)
            .where(Job.id == job.id, Job.state == PENDING)
            .values(state=RUNNING, attempts=Job.attempts + 1, started_at=now_instant())
        )
        if changed_rows(changed):
            session.flush()
            session.refresh(job)
            return _as_work(job)
    return None


def finish(session: Session, job_id: int, *, external_id: str | None = None) -> bool:
    """Mark a job done, unless somebody gave up on it while it ran.

    Returns whether the row moved, which is the only way the worker can tell a job it completed
    from one that was cancelled underneath it: the handler returns normally either way.
    """
    changed = session.execute(
        update(Job)
        .where(Job.id == job_id, Job.state != CANCELLED)
        .values(state=DONE, error=None, external_id=external_id, finished_at=now_instant())
    )
    return bool(changed_rows(changed))


def fail(session: Session, job_id: int, error: str, *, attempts: int) -> str:
    """Record a failure, and decide whether it is worth trying again.

    The error text is kept whatever happens: ``UI-15`` shows the real message and a retry button,
    because an error that explains what happened is what lets somebody fix a wrong URL themselves.

    A job cancelled while it ran keeps its cancellation and returns ``cancelled``. Whatever the
    provider said on the way down is not a failure anybody needs to read: the person who pressed
    cancel already knows why it stopped, and putting it back on the queue would restart the work
    they just stopped.
    """
    state = PENDING if attempts < MAX_ATTEMPTS else FAILED
    changed = session.execute(
        update(Job)
        .where(Job.id == job_id, Job.state != CANCELLED)
        .values(state=state, error=error[:2000], finished_at=now_instant())
    )
    if not changed_rows(changed):
        return CANCELLED
    return state


def cancel(session: Session, job_id: int) -> bool:
    """Give up on a job that has not finished.

    The row is the whole of it. A running handler is not killed -- it is asked, through
    :func:`is_cancelled`, and it stops at the next point where stopping is safe; and whether it
    stops or runs to the end, :func:`finish` and :func:`fail` leave the cancellation standing.
    """
    changed = session.execute(
        update(Job)
        .where(Job.id == job_id, Job.state.in_((PENDING, RUNNING)))
        .values(state=CANCELLED, finished_at=now_instant())
    )
    return bool(changed_rows(changed))


def is_cancelled(session: Session, job_id: int) -> bool:
    """Whether somebody has given up on this job since it was claimed.

    Read by a handler that is long enough to be worth interrupting. It is a fresh read every
    time on purpose: the claimed :class:`Work` is a value taken minutes ago, and the question is
    about now.
    """
    state = session.execute(select(Job.state).where(Job.id == job_id)).scalar_one_or_none()
    return state == CANCELLED


def cancel_transcription(session: Session, audio_id: int) -> Job | None:
    """Stop the transcription a recording has in flight, if it has one (``API-21``).

    The counterpart of :func:`enqueue_transcription`, and it answers the same way: ``None`` when
    there is nothing to do, which the endpoint renders as a conflict rather than as a failure.

    Nothing is undone. A cancelled job leaves no transcript and no state behind -- the recording
    reads as ``none`` again, because that is what it is -- and asking a second time queues fresh
    work rather than resuming this.
    """
    job = transcription_in_flight(session, audio_id)
    if job is None or not cancel(session, job.id):
        return None
    session.refresh(job)
    return job


def retry(session: Session, job_id: int) -> bool:
    """Put a failed or cancelled job back, with its attempts reset (``INT-3``, ``UI-15``).

    Resetting is deliberate: somebody clicking retry has usually just fixed the thing that broke,
    and making them click five more times to get past the old attempts would be punishing them
    for it.
    """
    changed = session.execute(
        update(Job)
        .where(Job.id == job_id, Job.state.in_((FAILED, CANCELLED)))
        .values(state=PENDING, attempts=0, error=None, finished_at=None, started_at=None)
    )
    return bool(changed_rows(changed))


def recover_interrupted(session: Session) -> int:
    """Put jobs the last process died holding back on the queue.

    Their attempt is counted rather than forgiven. A job that reliably kills the process would
    otherwise be picked up forever, and counting it means the queue eventually gives up and shows
    somebody the error instead.
    """
    changed = session.execute(
        update(Job).where(Job.state == RUNNING).values(state=PENDING, finished_at=now_instant())
    )
    return changed_rows(changed)


def counts(session: Session) -> dict[str, int]:
    """How much work is in each state, for the administration view (``INT-3``)."""
    tally = dict.fromkeys((PENDING, RUNNING, DONE, FAILED, CANCELLED), 0)
    for state in session.execute(select(Job.state)).scalars().all():
        tally[state] = tally.get(state, 0) + 1
    return tally


def _is_ready(job: Job) -> bool:
    """Whether a pending job's backoff has elapsed."""
    if job.attempts == 0 or job.finished_at is None:
        return True
    ready_at = parse_instant(job.finished_at) + timedelta(seconds=backoff_seconds(job.attempts))
    return utc_now() >= ready_at


def _as_work(job: Job) -> Work:
    try:
        payload = json.loads(job.payload) if job.payload else {}
    except json.JSONDecodeError:
        payload = {}
    return Work(
        id=job.id,
        kind=job.kind,
        audio_id=job.audio_id,
        attempts=job.attempts,
        payload=payload if isinstance(payload, dict) else {},
        external_id=job.external_id,
    )


def ready_at(job: Job) -> str:
    """When a pending job will next be eligible -- shown in the administration view."""
    if job.attempts == 0 or job.finished_at is None:
        return job.created_at
    return instant_after(
        timedelta(seconds=backoff_seconds(job.attempts)), since=parse_instant(job.finished_at)
    )
