"""Serving the built interface (``INF-3e``).

The image ships the API and the web interface together, so the one thing these tests hold is the
boundary between them: the API keeps every path it already had under ``/api`` (``API-16``), the
interface gets everything left over that a browser asked for, and a client that did not ask for
HTML gets the ordinary 404 in the ordinary envelope rather than a 200 with a page in it.

The bundle is written by hand here rather than built. What is under test is the routing, and a
test that needed ``npm run build`` first would be a test nobody runs.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.errors import PROBLEM_CONTENT_TYPE
from sonarium.api.spa import IMMUTABLE, SinglePageApp
from sonarium.core.config import Settings
from sonarium.db.engine import Database

SHELL = "<!doctype html><title>Sonarium</title><div id=root></div>"
BUNDLE = "console.log('the interface')"

BROWSER = {"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"}
"""What a browser sends when a person types a URL. The header is the only thing separating a
navigation from a fetch, so it is written out in full rather than abbreviated."""


@pytest.fixture
def bundle(tmp_path: Path) -> Path:
    """A built interface on disk, in the shape Vite writes."""
    static = tmp_path / "static"
    (static / "assets").mkdir(parents=True)
    (static / "index.html").write_text(SHELL, encoding="utf-8")
    (static / "assets" / "index-abc123.js").write_text(BUNDLE, encoding="utf-8")
    return static


@pytest.fixture
def serving(bundle: Path, tmp_path: Path, database: Database) -> FastAPI:
    """An instance that carries a built interface, as the image does."""
    app = create_app(
        Settings(
            data_dir=tmp_path / "data",
            secret_key=SecretStr("0" * 64),
            transcription_base_url="http://whisper:8000/v1",
            session_cookie_secure=False,
            static_dir=bundle,
        )
    )
    app.state.database = database
    return app


def test_an_instance_without_a_bundle_installs_nothing(app: FastAPI) -> None:
    """A developer running `npm run dev` beside uvicorn, and every test above this one."""
    assert app.state.spa is None


def test_an_empty_directory_is_not_a_bundle(tmp_path: Path) -> None:
    """The image creates /app early. An empty directory would fail later and less clearly."""
    (tmp_path / "static").mkdir()
    assert SinglePageApp.discover(tmp_path / "static") is None


def test_the_root_serves_the_shell(serving: FastAPI) -> None:
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/", headers=BROWSER)
    assert response.status_code == status.HTTP_200_OK
    assert response.text == SHELL


def test_a_client_route_the_server_never_heard_of_serves_the_shell(serving: FastAPI) -> None:
    """UI-4a puts real routes in the URL, so a hard refresh on one has to reach the client."""
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/sign-in", headers=BROWSER)
    assert response.status_code == status.HTTP_200_OK
    assert response.text == SHELL


@pytest.mark.parametrize(
    "route",
    [
        "/sign-in",
        "/library/8e29d6b4-0000-0000-0000-000000000000",
        "/library/8e29d6b4-0000-0000-0000-000000000000/settings",
        "/recording/8e29d6b4-0000-0000-0000-000000000000",
        "/search?q=rehearsal",
        "/trash",
        "/settings",
    ],
)
def test_every_route_the_interface_declares_can_be_hard_refreshed_into(
    serving: FastAPI, route: str
) -> None:
    """What API-16 bought, asserted route by route (DEC-24, UI-4a).

    This is the test that used to assert the opposite. The API was mounted at the root, so
    ``/search`` was an endpoint before it was a view and a hard refresh on it answered 401 rather
    than the shell -- and no ordering fixes that, because both are GET on one path. The API moved
    under ``/api`` instead of the routes being renamed around it, so this now enumerates §2.1 and
    expects the shell every time. A future endpoint cannot take one of these names back without
    turning this red.
    """
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get(route, headers=BROWSER)
    assert response.status_code == status.HTTP_200_OK
    assert response.text == SHELL


def test_a_mistyped_endpoint_is_a_404_even_for_a_browser(serving: FastAPI) -> None:
    """The one place the Accept rule gives the wrong answer.

    Under ``/api`` an unknown path is a mistyped endpoint, never a client route, so handing a
    browser a 200 and a page for it would turn a wrong call into a silent success in exactly the
    client most likely to make one.
    """
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/api/libraaries", headers=BROWSER)
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)


def test_the_hashed_bundle_is_served_and_cached_hard(serving: FastAPI) -> None:
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/assets/index-abc123.js")
    assert response.status_code == status.HTTP_200_OK
    assert response.text == BUNDLE
    assert response.headers["cache-control"] == IMMUTABLE


def test_the_shell_itself_is_revalidated(serving: FastAPI) -> None:
    """Otherwise a deployed update arrives only for people who clear their cache."""
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/", headers=BROWSER)
    assert response.headers["cache-control"] == "no-cache"


def test_the_api_keeps_every_path_it_had(serving: FastAPI) -> None:
    """The shell is a fallback, so an endpoint stays an endpoint even asked for by a browser."""
    with TestClient(serving, raise_server_exceptions=False) as client:
        instance = client.get("/api/instance", headers=BROWSER)
        document = client.get("/api/openapi.json", headers=BROWSER)
        ready = client.get("/readyz", headers=BROWSER)
    assert instance.json()["version"]
    assert document.json()["info"]["title"] == "Sonarium"
    assert ready.status_code == status.HTTP_200_OK
    assert ready.json()["status"] == "ready"


def test_an_unknown_path_is_still_a_404_for_anything_but_a_browser(serving: FastAPI) -> None:
    """A 200 with a page in it would turn every mistyped endpoint into a silent success."""
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/no-such-endpoint")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)


def test_the_shell_cannot_be_asked_for_a_file_outside_itself(
    serving: FastAPI, bundle: Path
) -> None:
    """A path is not a file name. INT-5 is the pass that checks this; here is where it holds."""
    (bundle.parent / "sonarium.db").write_text("the archive", encoding="utf-8")
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/../sonarium.db", headers=BROWSER)
    assert "the archive" not in response.text


def test_a_file_the_bundle_holds_at_its_root_is_served(serving: FastAPI, bundle: Path) -> None:
    """Not everything Vite emits lands under assets/ -- a robots.txt or a manifest does not."""
    (bundle / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf-8")
    with TestClient(serving, raise_server_exceptions=False) as client:
        response = client.get("/robots.txt", headers=BROWSER)
    assert response.status_code == status.HTTP_200_OK
    assert "Disallow" in response.text
