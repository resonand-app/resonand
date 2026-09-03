"""The in-process worker (``JOB-1``).

One container, one process, a pool of worker threads. That topology is a decision, not a
limitation: the archive is a single SQLite file, reads are free, and the only thing that has to be
serialised is writing -- which the connection layer already does. Splitting the worker into its
own process later needs no schema change, which is what makes running it here now a safe choice
rather than a corner cut.

Threads rather than processes because every long operation here -- ffmpeg, an HTTP request to a
transcription service -- releases the interpreter lock anyway. The work is not CPU-bound *in
Python*; it is waiting on something else, which is exactly what threads are for.

The worker is started by the application's lifespan and stopped with it. It also runs standalone,
which is what ``sonarium work`` uses.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

import structlog

from sonarium.core.errors import SonariumError
from sonarium.jobs import queue, retention
from sonarium.jobs.handlers import HANDLERS, Context

IDLE_POLL_SECONDS = 1.0
"""How long a thread sleeps when there is nothing to do.

A second is invisible to somebody who has just uploaded a file, and it keeps an idle instance off
the CPU. Anything shorter would spin a query per thread per tick for no benefit."""

_logger = structlog.get_logger(__name__)


@dataclass(slots=True)
class WorkerStats:
    """What the worker has done since it started, for the administration view."""

    completed: int = 0
    failed: int = 0
    retried: int = 0


class Worker:
    """Runs jobs until it is told to stop."""

    def __init__(self, context: Context, *, concurrency: int = 2) -> None:
        self._context = context
        self._concurrency = max(1, concurrency)
        self._stopping = threading.Event()
        self._threads: list[threading.Thread] = []
        self.stats = WorkerStats()

    def start(self) -> None:
        """Recover anything the last process died holding, then begin."""
        with self._context.database.write_session() as session:
            recovered = queue.recover_interrupted(session)
        if recovered:
            _logger.info("jobs.recovered", count=recovered)
        for index in range(self._concurrency):
            thread = threading.Thread(
                target=self._loop, name=f"sonarium-worker-{index}", daemon=True
            )
            thread.start()
            self._threads.append(thread)

    def stop(self, *, timeout: float = 10.0) -> None:
        """Ask the threads to finish what they are on and stop.

        A job in flight is allowed to complete rather than being killed: an interrupted transcode
        leaves a temporary file, and an interrupted transcription has already been paid for.
        """
        self._stopping.set()
        for thread in self._threads:
            thread.join(timeout=timeout)
        self._threads.clear()

    def wait(self) -> None:
        """Block until the worker is stopped. What a foreground ``sonarium work`` does."""
        while not self._stopping.wait(1.0):
            continue

    def schedule_maintenance(self) -> bool:
        """Queue today's retention purge if it has not been queued yet (``INT-2``).

        The idempotency key carries the date, so this is safe to call as often as the loop
        likes -- which is what lets the schedule survive restarts without any state of its
        own.
        """
        with self._context.database.write_session() as session:
            return retention.schedule(session)

    def run_once(self) -> bool:
        """Claim and run a single job. Returns whether there was one.

        The whole worker in one testable step: everything the loop does is call this.
        """
        with self._context.database.write_session() as session:
            work = queue.claim(session)
        if work is None:
            return False
        handler = HANDLERS.get(work.kind)
        if handler is None:
            with self._context.database.write_session() as session:
                queue.fail(
                    session,
                    work.id,
                    f"There is no handler for {work.kind!r} jobs in this build.",
                    attempts=queue.MAX_ATTEMPTS,
                )
            return True
        try:
            handler(work, self._context)
        except SonariumError as error:
            self._record_failure(work, error.detail)
        except Exception as error:
            self._record_failure(work, f"{type(error).__name__}: {error}")
        else:
            with self._context.database.write_session() as session:
                queue.finish(session, work.id)
            self.stats.completed += 1
            _logger.info("job.done", job_id=work.id, kind=work.kind)
        return True

    def _record_failure(self, work: queue.Work, message: str) -> None:
        """Store the real message, because ``UI-15`` shows it and a retry button.

        An error that says what happened is what lets somebody fix a mistyped URL themselves; one
        that apologises leaves them with nothing to act on.
        """
        with self._context.database.write_session() as session:
            state = queue.fail(session, work.id, message, attempts=work.attempts)
        if state == queue.FAILED:
            self.stats.failed += 1
            _logger.error("job.failed", job_id=work.id, kind=work.kind, error=message)
        else:
            self.stats.retried += 1
            _logger.warning(
                "job.retrying",
                job_id=work.id,
                kind=work.kind,
                attempt=work.attempts,
                next_in_seconds=queue.backoff_seconds(work.attempts),
                error=message,
            )

    def _loop(self) -> None:
        while not self._stopping.is_set():
            try:
                self.schedule_maintenance()
                did_something = self.run_once()
            except Exception:
                _logger.exception("worker.loop_error")
                did_something = False
            if not did_something:
                self._stopping.wait(IDLE_POLL_SECONDS)


def drain(worker: Worker, *, limit: int = 100, timeout: float = 60.0) -> int:
    """Run jobs until there are none left. For tests and for the CLI's one-shot mode."""
    started = time.monotonic()
    done = 0
    while done < limit and time.monotonic() - started < timeout:
        if not worker.run_once():
            return done
        done += 1
    return done
