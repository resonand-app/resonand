"""🧪 The instance says what changed, and only to people who may hear it (``REV-12``).

The test that would be a security incident if it failed is
``test_a_subscriber_is_never_told_about_a_recording_it_cannot_read``. A stream is a worse place to
disclose that a recording exists than an endpoint is, because nobody asked for it: the event
arrives unbidden and names something, and naming it is the whole of the disclosure.

**These drive the response body directly rather than through ``TestClient``**, which cannot be
used here at all: it runs the ASGI application to completion and hands back the collected body, so
a request to an endless stream never returns a response object. Everything below the transport is
covered here; that the bytes reach a browser over a real connection is the one thing this file
cannot show, and it was checked by hand against a running instance.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import anyio
import pytest
from fastapi.testclient import TestClient
from sonarium.api.routes import events
from sonarium.core.changes import AUDIO, LIBRARY, QUEUE_DEPTH, RESYNC, Change, Changes
from sonarium.db import libraries as library_repo
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from starlette.requests import Request

READY = ": ready\n\n"
KEEP_ALIVE = ": keep-alive\n\n"
NOTHING = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def archive(database: Database, accounts: dict[str, int]) -> dict[str, str]:
    """A recording and a library each for the administrator and the stranger, shared with nobody."""
    made: dict[str, str] = {}
    with database.write_session() as session:
        for name in ("admin", "stranger"):
            library = library_repo.create_library(session, accounts[name], name=f"{name}'s")
            audio = create_audio(
                session,
                library_id=library.id,
                uploaded_by=accounts[name],
                storage_path=f"storage/aa/{name}/original.m4a",
                original_filename=f"{name}.m4a",
            )
            made[name] = audio.uuid
            made[f"{name}_library"] = library.uuid
    return made


def _connected() -> Request:
    """A request that is open and stays open. Closing the stream is what ends it, as in a server."""

    async def receive() -> dict[str, object]:
        await anyio.sleep_forever()
        raise AssertionError("unreachable")

    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/events",
            "headers": [],
            "query_string": b"",
        },
        receive=receive,
    )


class Reader:
    """The stream, opened and read a chunk at a time, with every read bounded.

    A stream that says nothing when it should has to fail rather than hang, which is the whole
    difficulty of testing one.
    """

    def __init__(self, stream: AsyncIterator[str]) -> None:
        self._stream = stream

    async def chunk(self, *, within: float = 5.0) -> str:
        with anyio.fail_after(within):
            return await anext(self._stream)

    async def skipping_keep_alives(self, *, within: float = 5.0) -> str:
        for _ in range(4):
            chunk = await self.chunk(within=within)
            if chunk != KEEP_ALIVE:
                return chunk
        raise AssertionError("nothing but keep-alives arrived")


async def _open(database: Database, changes: Changes, user_id: int) -> Reader:
    """Open a stream and wait until it is subscribed, so a publish afterwards cannot be missed."""
    stream = events._stream(_connected(), database, changes, user_id)
    reader = Reader(stream)
    assert await reader.chunk() == READY
    return reader


def _framed(kind: str, uuid: str) -> str:
    return f'event: {kind}\ndata: {{"uuid": "{uuid}"}}\n\n'


def test_a_subscriber_is_never_told_about_a_recording_it_cannot_read(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    """The stranger owns one recording and cannot see the administrator's.

    Both are published, and the *second* is the one that may arrive — a test that only counted
    events would pass on a stream that sent the wrong one.
    """

    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        changes.publish(Change(kind=AUDIO, uuid=archive["admin"]))
        changes.publish(Change(kind=AUDIO, uuid=archive["stranger"]))
        assert await reader.skipping_keep_alives() == _framed(AUDIO, archive["stranger"])

    anyio.run(scenario)


def test_a_library_event_resolves_the_same_way(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        changes.publish(Change(kind=LIBRARY, uuid=archive["admin_library"]))
        changes.publish(Change(kind=LIBRARY, uuid=archive["stranger_library"]))
        assert await reader.skipping_keep_alives() == _framed(LIBRARY, archive["stranger_library"])

    anyio.run(scenario)


def test_a_uuid_that_names_nothing_is_not_sent(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    """Holding no level and there being nothing there are the same answer, as they are on `GET`."""

    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        changes.publish(Change(kind=AUDIO, uuid=NOTHING))
        changes.publish(Change(kind=AUDIO, uuid=archive["stranger"]))
        assert await reader.skipping_keep_alives() == _framed(AUDIO, archive["stranger"])

    anyio.run(scenario)


def test_resync_reaches_everybody_because_it_names_nothing(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    """There is no identity in it, so there is nothing in it to be refused."""

    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        changes.publish(Change(kind=RESYNC, uuid=""))
        assert await reader.skipping_keep_alives() == _framed(RESYNC, "")

    anyio.run(scenario)


def test_a_subscriber_that_falls_behind_is_told_to_start_again(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    """Rather than being disconnected, or silently missing something it will never learn about."""

    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        for _ in range(QUEUE_DEPTH * 2):
            changes.publish(Change(kind=AUDIO, uuid=archive["stranger"]))
        arrived = [await reader.chunk() for _ in range(QUEUE_DEPTH + 1)]
        assert _framed(RESYNC, "") in arrived

    anyio.run(scenario)


def test_a_quiet_stream_still_says_something(
    database: Database,
    accounts: dict[str, int],
    archive: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A proxy closes an idle connection, and a quiet stream looks exactly like a broken one."""
    monkeypatch.setattr(events, "HEARTBEAT_SECONDS", 0.05)

    async def scenario() -> None:
        changes = Changes()
        reader = await _open(database, changes, accounts["stranger"])
        assert await reader.chunk() == KEEP_ALIVE

    anyio.run(scenario)


def test_closing_the_stream_stops_the_subscription(
    database: Database, accounts: dict[str, int], archive: dict[str, str]
) -> None:
    """What a server does when the client goes away. A subscriber left behind is a leak."""

    async def scenario() -> None:
        changes = Changes()
        stream = events._stream(_connected(), database, changes, accounts["stranger"])
        assert await anext(stream) == READY
        assert changes.listeners == 1
        await stream.aclose()
        assert changes.listeners == 0

    anyio.run(scenario)


def test_the_stream_needs_a_session(client: TestClient, accounts: dict[str, int]) -> None:
    """It is a read of the archive like any other. Refused before anything is subscribed."""
    assert client.get("/events").status_code == 401


def test_the_stream_is_published_as_an_endpoint(client: TestClient) -> None:
    """``UI-3`` generates its client from the document, so the stream has to be in it."""
    document = client.get("/openapi.json").json()
    assert "/api/events" in document["paths"]
