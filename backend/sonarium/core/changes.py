"""Announcing that something changed, without saying what it now is (``REV-12``).

The instance knows the exact moment a transcription became readable, a duration became known, a
waveform became drawable -- ``jobs/worker.py`` writes ``finished_at`` -- and used to discard it.
Every client learned it by asking again on a timer, which cost the instance the same two rows six
times a minute per open tab and cost the client the correctness of inferring an edge from two
polled levels.

**A change carries an identity and never contents.** "Recording ``{uuid}`` changed" is the whole
of the payload, and the client fetches what it already knows how to fetch. That is what keeps this
out of the permission problem: a stream that carried a title would be a second way to read one,
with its own rules to keep in step with the ACL, and the two would drift.

**It lives in ``core`` because ``api`` and ``jobs`` are peers.** The worker publishes and the
stream subscribes, and neither may import the other. That it can be a set of in-process queues at
all is what ``REV-11`` settled: one process writes this archive, so the fan-out is a function call
rather than a table somebody polls -- which would be this problem again, one layer down.

**A subscriber that cannot keep up is told to start again** rather than being disconnected or
silently missing something. The queue is bounded; when it overflows the subscriber is handed one
``resync`` instead of the events it lost, and refetching is a thing every client here already
knows how to do.
"""

from __future__ import annotations

import asyncio
import threading
from collections.abc import AsyncIterator, Iterator
from contextlib import contextmanager
from dataclasses import dataclass

AUDIO = "audio"
"""A recording changed: its metadata, its transcription, its waveform, where it lives."""

LIBRARY = "library"
"""A library changed: its name, what is in it, who it is shared with."""

RESYNC = "resync"
"""This subscriber missed something and should fetch everything it is showing."""

QUEUE_DEPTH = 64
"""Changes a subscriber may fall behind by before it is told to start again.

Deep enough that an ordinary burst -- a bulk action over a page of recordings -- arrives in full,
and shallow enough that a tab a laptop suspended does not hold a thousand of them.
"""


@dataclass(frozen=True, slots=True)
class Change:
    """One thing that changed, named and not described."""

    kind: str
    """``AUDIO``, ``LIBRARY`` or ``RESYNC``."""

    uuid: str
    """The public identifier of what changed. Empty for ``RESYNC``, which names nothing."""


RESYNC_CHANGE = Change(kind=RESYNC, uuid="")


class Subscription:
    """One listener's queue, filled from any thread and read from the one that made it."""

    def __init__(self, loop: asyncio.AbstractEventLoop, *, depth: int = QUEUE_DEPTH) -> None:
        self._loop = loop
        self._queue: asyncio.Queue[Change] = asyncio.Queue(maxsize=depth)
        self._missed = False

    def offer(self, change: Change) -> None:
        """Hand this subscriber a change. Called from the worker's threads, never from the loop.

        ``call_soon_threadsafe`` raises once the loop has closed, which happens when the instance
        is shutting down while a job finishes. There is nobody left to tell, so there is nothing
        to do about it.
        """
        try:
            self._loop.call_soon_threadsafe(self._enqueue, change)
        except RuntimeError:
            return

    def _enqueue(self, change: Change) -> None:
        try:
            self._queue.put_nowait(change)
        except asyncio.QueueFull:
            self._missed = True

    async def next(self, *, timeout: float) -> Change | None:
        """The next change, or ``None`` when the wait ran out and a heartbeat is due."""
        if self._missed:
            self._missed = False
            return RESYNC_CHANGE
        try:
            return await asyncio.wait_for(self._queue.get(), timeout=timeout)
        except TimeoutError:
            return None


class Changes:
    """Who is listening, and how they are told.

    One per instance, held on the application state and handed to the worker, so that a test can
    have its own and two applications in one process cannot reach each other's subscribers.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._subscribers: set[Subscription] = set()

    @contextmanager
    def subscribe(self) -> Iterator[Subscription]:
        """Listen for the length of the block, on the loop that entered it."""
        subscription = Subscription(asyncio.get_running_loop())
        with self._lock:
            self._subscribers.add(subscription)
        try:
            yield subscription
        finally:
            with self._lock:
                self._subscribers.discard(subscription)

    def publish(self, change: Change) -> None:
        """Tell everybody listening. Safe from any thread, and never raises at the caller.

        Publishing is not allowed to fail the thing that happened: a job that finished has
        finished whether or not anybody heard about it.
        """
        with self._lock:
            listening = tuple(self._subscribers)
        for subscription in listening:
            subscription.offer(change)

    @property
    def listeners(self) -> int:
        """How many are subscribed, for the worker deciding whether to look a uuid up."""
        with self._lock:
            return len(self._subscribers)


async def heartbeats(subscription: Subscription, *, every: float) -> AsyncIterator[Change | None]:
    """Changes as they arrive, with a ``None`` whenever ``every`` seconds pass without one.

    The gap is what the caller turns into a comment on the wire. Without one, a reverse proxy
    closes an idle stream after its own timeout and the client reconnects for no reason -- and
    neither end finds out until it happens, because a stream that is merely quiet looks exactly
    like a stream that is broken.
    """
    while True:
        yield await subscription.next(timeout=every)
