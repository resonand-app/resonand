"""Behind a reverse proxy, on a subdomain and on a subpath (``OPS-4``).

In v0 because retrofitting a base path into an SPA is genuinely painful, and because the subpath
is the one that always ends up broken -- usually in a way that only shows up in somebody else's
deployment, which is the worst place to find out.

The two shapes:

* **A subdomain** -- ``sonarium.example.org`` proxied to the container. Nothing is rewritten and
  ``SONARIUM_BASE_PATH`` stays empty.
* **A subpath** -- ``example.org/sonarium`` proxied with the prefix left on. Every URL the
  application generates has to carry it, and the proxy has to pass it through rather than strip
  it, which is the part every guide gets wrong in a different direction.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.core.config import Settings
from sonarium.db.engine import Database

from tests.api.conftest import PASSWORD, sign_in


def _instance(
    tmp_path: Path,
    database: Database,
    base_path: str,
    *,
    proxy_strips: bool = False,
    at_origin: bool = False,
) -> TestClient:
    """An instance as a browser reaches it.

    The base URL carries the prefix because **the browser always sees it**, whichever thing
    the proxy does with it. ``proxy_strips`` models the other half of the arrangement: a proxy
    that removes the prefix before forwarding, so the application sees an unprefixed path with
    ``root_path`` set. Both have to work, and the cookie path is the same in both, because it
    is scoped to what the browser requested rather than to what the application received.

    ``at_origin`` drops the ``/api`` half of the base, for the probes and the shell, which sit
    under the deployment prefix but outside the API (``API-16``).
    """
    settings = Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        session_cookie_secure=False,
        base_path=base_path,
    )
    app = create_app(settings)
    app.state.database = database
    prefix = "" if proxy_strips else settings.base_path
    api = "" if at_origin else "/api"
    client = TestClient(
        app,
        root_path=settings.base_path,
        base_url=f"http://testserver{prefix}{api}",
        raise_server_exceptions=False,
    )
    client.__enter__()
    return client


@pytest.fixture
def on_a_subpath(tmp_path: Path, database: Database) -> TestClient:
    return _instance(tmp_path, database, "/sonarium")


@pytest.fixture
def on_a_subdomain(tmp_path: Path, database: Database) -> TestClient:
    return _instance(tmp_path, database, "")


@pytest.fixture
def origin_on_a_subpath(tmp_path: Path, database: Database) -> TestClient:
    """The same instance, reached at the deployment root rather than at its API."""
    return _instance(tmp_path, database, "/sonarium", at_origin=True)


@pytest.mark.parametrize("given", ["/sonarium", "sonarium", "/sonarium/", "sonarium/"])
def test_a_base_path_is_normalised_however_it_was_written(
    tmp_path: Path, database: Database, given: str
) -> None:
    """Half the breakages here are a trailing slash somewhere, so it is settled once."""
    settings = Settings(data_dir=tmp_path, base_path=given)
    assert settings.base_path == "/sonarium"
    assert create_app(settings).root_path == "/sonarium"


def test_the_api_answers_whether_the_proxy_strips_the_prefix_or_passes_it_through(
    tmp_path: Path, database: Database
) -> None:
    """The two ways every reverse-proxy guide sets this up, and they disagree with each other.

    Both are supported, because whichever one an administrator has already written is the one
    they will keep.
    """
    passes_through = _instance(tmp_path, database, "/sonarium")
    strips = _instance(tmp_path, database, "/sonarium", proxy_strips=True)
    try:
        assert passes_through.get("/instance").status_code == status.HTTP_200_OK
        assert strips.get("/instance").status_code == status.HTTP_200_OK
    finally:
        passes_through.__exit__(None, None, None)
        strips.__exit__(None, None, None)


def test_the_published_document_names_the_subpath(on_a_subpath: TestClient) -> None:
    """UI-3 generates its client from this, so a wrong server URL there breaks every call."""
    document = on_a_subpath.get("/openapi.json").json()
    assert document["servers"][0]["url"] == "/sonarium"


def test_the_document_names_no_server_on_a_subdomain(on_a_subdomain: TestClient) -> None:
    """An unnecessary rewrite is its own kind of broken."""
    document = on_a_subdomain.get("/openapi.json").json()
    assert not document.get("servers")


def test_the_api_answers_normally_under_a_subpath(
    on_a_subpath: TestClient, origin_on_a_subpath: TestClient, accounts: dict[str, int]
) -> None:
    assert origin_on_a_subpath.get("/").status_code == status.HTTP_200_OK
    assert on_a_subpath.get("/instance").json()["name"] == "sonarium"


def test_signing_in_works_under_a_subpath(
    on_a_subpath: TestClient, accounts: dict[str, int]
) -> None:
    signed_in = on_a_subpath.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert signed_in.status_code == status.HTTP_200_OK
    assert on_a_subpath.get("/auth/me").status_code == status.HTTP_200_OK


def test_the_session_cookie_is_scoped_to_the_subpath(
    on_a_subpath: TestClient, accounts: dict[str, int]
) -> None:
    """A cookie at ``/`` would be sent to every other application on the same domain."""
    response = on_a_subpath.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert "path=/sonarium/" in response.headers["set-cookie"].lower()


def test_the_cookie_is_at_the_root_on_a_subdomain(
    on_a_subdomain: TestClient, accounts: dict[str, int]
) -> None:
    response = on_a_subdomain.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert "path=/;" in response.headers["set-cookie"].lower() + ";"


def test_signing_out_clears_the_cookie_it_actually_set(
    on_a_subpath: TestClient, accounts: dict[str, int]
) -> None:
    """A delete_cookie at the wrong path leaves the session cookie in place, and the user stays
    signed in after clicking sign out."""
    sign_in(on_a_subpath, "admin")
    signed_out = on_a_subpath.delete("/auth/session")
    assert signed_out.status_code == status.HTTP_204_NO_CONTENT
    assert "path=/sonarium/" in signed_out.headers["set-cookie"].lower()
    assert on_a_subpath.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED


def test_a_problem_response_is_the_same_shape_under_a_subpath(on_a_subpath: TestClient) -> None:
    refused = on_a_subpath.get("/libraries")
    assert refused.status_code == status.HTTP_401_UNAUTHORIZED
    assert refused.json()["type"] == "/errors/unauthenticated"


def test_the_health_endpoints_answer_under_a_subpath(origin_on_a_subpath: TestClient) -> None:
    """Whatever restarts the container probes these, and it probes them through the proxy.

    Under the deployment prefix and not under ``/api``: the probes stayed at the root when the
    API moved (``API-16``), because the compose file and the image's own healthcheck name them.
    """
    assert origin_on_a_subpath.get("/healthz").json()["status"] == "ok"
    assert origin_on_a_subpath.get("/readyz").json()["status"] == "ready"
