"""🧪 The request body ceiling (``SEC-1``).

The property that matters is not that a large body is refused -- it is **where** it is refused.
``upload`` already compared the stream against ``max_upload_bytes``, and that check ran after
Starlette had spooled the whole body to a temporary file, on the same disk as the archive, for a
caller it had not yet authenticated.

So the test that earns its place is the one that counts bytes written to disk rather than statuses:
:func:`test_an_oversized_body_reaches_no_temporary_file` fails on the old code with tens of
megabytes written, and the status was 401 both before and after.
"""

from __future__ import annotations

import io
import tempfile
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.limits import MULTIPART_ENVELOPE_BYTES
from sonarium.core.config import Settings
from sonarium.db.engine import Database

from tests.api.conftest import API_BASE, PASSWORD, sign_in

SMALL_UPLOAD = 4096
"""The upload ceiling these tests run against. Small enough to cross in a test, and the arithmetic
around ``MULTIPART_ENVELOPE_BYTES`` is the same at any size."""

SMALL_BODY = 2048
"""The non-upload ceiling. A sign-in is a few hundred bytes, so this is still generous."""


@pytest.fixture
def tight_settings(tmp_path: Path) -> Settings:
    """An instance with both ceilings low enough to reach from a test."""
    return Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        log_format="console",
        session_cookie_secure=False,
        max_upload_bytes=SMALL_UPLOAD,
        max_request_bytes=SMALL_BODY,
    )


@pytest.fixture
def tight_client(tight_settings: Settings, database: Database) -> Iterator[TestClient]:
    app: FastAPI = create_app(tight_settings)
    app.state.database = database
    with TestClient(app, base_url=API_BASE, raise_server_exceptions=False) as client:
        yield client


def _spooled_bytes(monkeypatch: pytest.MonkeyPatch) -> list[int]:
    """Count every byte written to a spooled temporary file, which is where a body lands.

    Starlette's multipart parser writes each part into one of these, rolling it onto disk past its
    threshold. Counting the writes is the only way to observe the thing this ceiling exists to
    prevent: the status code was already 401 before the fix, with the bytes on disk anyway.
    """
    written = [0]
    real_write = tempfile.SpooledTemporaryFile.write

    def counting_write(self: tempfile.SpooledTemporaryFile, data: bytes) -> int:  # type: ignore[type-arg]
        written[0] += len(data)
        return int(real_write(self, data))

    monkeypatch.setattr(tempfile.SpooledTemporaryFile, "write", counting_write)
    return written


def test_an_oversized_body_reaches_no_temporary_file(
    tight_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The bytes are refused before anything buffers them, and before anybody is authenticated.

    No session is sent deliberately. The old order authenticated *after* parsing the body, so an
    unauthenticated request could fill the volume the archive is on and then be told 401 for its
    trouble.
    """
    written = _spooled_bytes(monkeypatch)
    payload = b"A" * (SMALL_UPLOAD + MULTIPART_ENVELOPE_BYTES + 4096)

    response = tight_client.post(
        "/libraries/whatever/audio",
        files={"file": ("long.mp3", io.BytesIO(payload), "audio/mpeg")},
    )

    assert response.status_code == 413
    assert response.headers["content-type"].startswith("application/problem+json")
    assert written[0] == 0


def test_a_refusal_is_a_problem_document_with_a_request_id(tight_client: TestClient) -> None:
    """Refused by middleware, but answered in the shape every other failure uses.

    The ceiling runs outside the exception handlers, so it builds this itself -- which is exactly
    the kind of thing that drifts from the shape the interface parses.
    """
    response = tight_client.post(
        "/auth/session", json={"email": "a@example.test", "password": "x" * (SMALL_BODY + 1)}
    )

    assert response.status_code == 413
    body = response.json()
    assert body["type"] == "/errors/too_large"
    assert body["status"] == 413
    assert body["title"] == "Too large"
    assert "X-Request-Id" in response.headers


def test_a_body_that_understates_its_length_is_still_counted(tight_client: TestClient) -> None:
    """A sender that omits ``Content-Length`` does not get a larger ceiling.

    The declared length is refused outright and is the path every browser takes; this is the other
    one, and it is why the ceiling counts as well as reads.
    """

    def chunks() -> Iterator[bytes]:
        for _ in range(8):
            yield b"B" * SMALL_BODY

    response = tight_client.post(
        "/auth/session",
        content=chunks(),
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 413


def test_an_ordinary_request_is_untouched(client: TestClient, accounts: dict[str, int]) -> None:
    """The ceiling is not reachable by anything real. A sign-in is a few hundred bytes."""
    del accounts
    sign_in(client, "admin")
    assert client.get("/auth/me").status_code == 200


def test_an_upload_is_measured_against_its_own_ceiling(
    tight_client: TestClient, accounts: dict[str, int]
) -> None:
    """A recording is not held to the ceiling a sign-in is held to.

    The two limits are the whole reason this middleware reads the content type, so a body between
    them has to pass here and fail on a JSON endpoint.
    """
    del accounts
    tight_client.post("/auth/session", json={"email": "admin@example.test", "password": PASSWORD})
    between = b"C" * (SMALL_BODY * 2)
    assert len(between) > SMALL_BODY

    response = tight_client.post(
        "/libraries/no-such-library/audio",
        files={"file": ("short.mp3", io.BytesIO(between), "audio/mpeg")},
    )

    # 404 for a library this caller cannot read -- which is the endpoint answering, so the body
    # got past the ceiling rather than being refused by it.
    assert response.status_code == 404
