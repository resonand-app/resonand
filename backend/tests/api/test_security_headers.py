"""🧪 The headers every response carries (``SEC-4``).

The instance was sending none of these, so the tests worth having are the ones that say what each
one is for -- not a list of names anybody could satisfy by adding a header that does nothing.

The policy's script rule is the part with a moving piece: the shell's inline theme script is named
by hash, and the hash is read out of the built shell. So the test that matters builds a shell and
checks the two agree, because a policy that refuses the page it is protecting is the failure that
would otherwise be found by a user with a white screen.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.headers import DOCS_PATH
from sonarium.api.spa import inline_script_hashes
from sonarium.core.config import Settings
from sonarium.db.engine import Database

SHELL = """<!doctype html>
<html><head>
  <script>
    try { document.documentElement.setAttribute('data-theme', 'dark'); } catch (error) {}
  </script>
  <script type="module" src="/assets/index-abc123.js"></script>
</head><body><div id="root"></div></body></html>
"""


@pytest.fixture
def bundled(tmp_path: Path, database: Database) -> Iterator[TestClient]:
    """An instance that has a built interface, which is what the policy is written against."""
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text(SHELL, encoding="utf-8")
    settings = Settings(
        data_dir=tmp_path / "data",
        static_dir=static,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        log_format="console",
        session_cookie_secure=False,
    )
    app: FastAPI = create_app(settings)
    app.state.database = database
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def _policy(client: TestClient, path: str = "/healthz") -> str:
    return client.get(path).headers["content-security-policy"]


def test_the_instance_cannot_be_put_in_a_frame(origin_client: TestClient) -> None:
    """Purge is a confirmation away, and a confirmation in an invisible frame is the old trick."""
    headers = origin_client.get("/healthz").headers
    assert "frame-ancestors 'none'" in headers["content-security-policy"]
    assert headers["x-frame-options"] == "DENY"


def test_uploaded_bytes_are_not_sniffed(origin_client: TestClient) -> None:
    """The stream serves somebody's file under a type guessed from the name they chose."""
    assert origin_client.get("/healthz").headers["x-content-type-options"] == "nosniff"


def test_nothing_may_be_loaded_from_anywhere_else(origin_client: TestClient) -> None:
    """One origin serves the interface, the API and the audio. There is no second one."""
    policy = _policy(origin_client)
    assert "default-src 'self'" in policy
    assert "connect-src 'self'" in policy
    assert "object-src 'none'" in policy
    assert "base-uri 'none'" in policy


def test_the_shells_own_script_is_allowed_by_hash_and_inline_script_is_not(
    bundled: TestClient, tmp_path: Path
) -> None:
    """The theme bootstrap has to run before the bundle, so it is named rather than waved through.

    Two assertions and the second is the point: naming it by hash is only worth doing if
    ``'unsafe-inline'`` is absent, because one ``'unsafe-inline'`` makes every hash decorative.
    """
    hashes = inline_script_hashes(tmp_path / "static")
    assert len(hashes) == 1

    script_rule = next(
        rule.strip()
        for rule in _policy(bundled).split(";")
        if rule.strip().startswith("script-src")
    )
    assert hashes[0] in script_rule
    assert "'unsafe-inline'" not in script_rule


def test_an_instance_with_no_bundle_allows_no_inline_script_at_all(
    origin_client: TestClient,
) -> None:
    """A missing shell produces the strictest answer rather than a missing one."""
    script_rule = next(
        rule.strip()
        for rule in _policy(origin_client).split(";")
        if rule.strip().startswith("script-src")
    )
    assert script_rule == "script-src 'self'"


def test_the_documentation_viewer_is_the_one_exemption_and_is_still_unframeable(
    origin_client: TestClient,
) -> None:
    """FastAPI's page loads Swagger from a CDN and boots it inline. It is not this project's page.

    What it does not get is an exemption from the rest: it is on this origin, so it is one more
    place the instance could be attacked through if it could be framed.
    """
    policy = _policy(origin_client, DOCS_PATH)
    assert "cdn.jsdelivr.net" in policy
    assert "frame-ancestors 'none'" in policy
    assert origin_client.get(DOCS_PATH).headers["x-content-type-options"] == "nosniff"


def test_a_refused_body_is_answered_with_the_headers_too(origin_client: TestClient) -> None:
    """The ceiling answers from middleware, so it sits inside this one rather than outside it."""
    response = origin_client.post("/api/auth/session", content=b"x" * (2 * 1024 * 1024))
    assert response.status_code == 413
    assert response.headers["x-content-type-options"] == "nosniff"
