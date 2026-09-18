"""The stream that says something changed (``REV-12``).

Server-sent events rather than a websocket: everything here travels one way, SSE is a GET that
carries the session cookie and reconnects by itself, and a websocket would be a second transport
with its own authentication for a feature that never needs to say anything back.

**Every event is resolved against the ACL for the subscriber it is about to reach**, in a read
session opened for that one question and closed again. This is a fourth reader of ``acl/query.py``
and not a way around it: an event naming a recording somebody cannot read tells them it exists,
which is the leak the 404-not-403 rule exists to prevent, and a stream is a worse place to leak it
than an endpoint because nobody asked.

**The session is resolved once, when the stream opens.** A stream held for an hour by somebody
whose access was withdrawn ten minutes ago is the cost, and it is bounded by the permission check
on every event: they stop being told about anything they can no longer read, and the moment they
act on what they were told the endpoint refuses them. Re-authenticating mid-stream would need the
cookie re-read on a request that is not arriving.

**No replay and no ``Last-Event-ID``.** There is no durable log to replay from, and inventing one
would be this problem again with a table in the middle. A client that reconnects refetches what it
is showing, which is what it does on its first load anyway.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from sonarium.acl.query import audio_level, library_level
from sonarium.api.deps import ArchiveDatabase, CurrentCaller
from sonarium.core import changes as change_kinds
from sonarium.core.changes import Change, Changes
from sonarium.db.engine import Database

router = APIRouter(tags=["events"])

HEARTBEAT_SECONDS = 20.0
"""How long the stream may be silent before it says something anyway.

Under the reverse proxy this deployment recommends, an idle connection is closed at sixty
seconds. Twenty is comfortably inside that and is invisible: a comment is two dozen bytes.
"""

_logger = structlog.get_logger(__name__)


def _readable(database: Database, user_id: int, change: Change) -> bool:
    """Whether this subscriber may be told about this change.

    A read session per event, which is what it costs to keep the resolution inside the database
    rather than caching a permission in the stream and having to invalidate it.
    """
    if change.kind == change_kinds.RESYNC:
        return True
    with database.read_session() as session:
        if change.kind == change_kinds.AUDIO:
            return audio_level(session, user_id, change.uuid) is not None
        return library_level(session, user_id, change.uuid) is not None


def _framed(change: Change) -> str:
    """One change as the wire format. The data is an identity and nothing else."""
    return f'event: {change.kind}\ndata: {{"uuid": "{change.uuid}"}}\n\n'


async def _stream(
    request: Request, database: Database, changes: Changes, user_id: int
) -> AsyncGenerator[str]:
    """What the subscriber receives, for as long as they are connected."""
    with changes.subscribe() as subscription:
        # Before anything else, so that a client knows it is connected rather than inferring it
        # from the first thing that happens to change -- which on a quiet archive is never.
        yield ": ready\n\n"
        while not await request.is_disconnected():
            change = await subscription.next(timeout=HEARTBEAT_SECONDS)
            if change is None:
                yield ": keep-alive\n\n"
                continue
            if _readable(database, user_id, change):
                yield _framed(change)


@router.get("/events", summary="What has changed, as it changes")
async def events(
    request: Request, caller: CurrentCaller, database: ArchiveDatabase
) -> StreamingResponse:
    """Subscribe to changes in the archive this caller can see.

    Answers ``text/event-stream``. Each event names one thing -- ``audio`` or ``library`` and a
    uuid -- and carries nothing about it; ``resync`` names nothing and means fetch everything you
    are showing.
    """
    _logger.info("events.subscribed", user_id=caller.id)
    return StreamingResponse(
        _stream(request, database, request.app.state.changes, caller.id),
        media_type="text/event-stream",
        headers={
            # A proxy that buffers this has turned a stream into a very slow page.
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
