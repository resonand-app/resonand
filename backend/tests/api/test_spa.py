"""Serving the built interface (``INF-3e``).

The image ships the API and the web interface together, so the one thing these tests hold is the
boundary between them: the API keeps every path it already had under ``/api`` (``API-16``), the
interface gets everything left over that a browser asked for, and a client that did not ask for
HTML gets the ordinary 404 in the ordinary envelope rather than a 200 with a page in it.

The bundle is written by hand here rather than built. What is under test is the routing, and a
test that needed ``npm run build`` first would be a test nobody runs.
"""

from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urljoin, urlparse

import pytest
from fastapi import FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.errors import PROBLEM_CONTENT_TYPE
from sonarium.api.spa import (
    IMMUTABLE,
    SinglePageApp,
    inline_script_hashes,
    rebase,
    script_hashes_of,
)
from sonarium.core.config import Settings
from sonarium.db.engine import Database

BOOTSTRAP = "<script>document.documentElement.dataset.theme='dark'</script>"
"""Standing in for the theme bootstrap, which the content policy names by hash (``SEC-4``)."""

SHELL = (
    '<!doctype html><html><head><base href="/" />'
    f"<title>Sonarium</title>{BOOTSTRAP}"
    '<link rel="manifest" href="./site.webmanifest" />'
    '<script type="module" src="./assets/index-abc123.js"></script>'
    "</head><body><div id=root></div></body></html>"
)
"""The shape Vite writes with a relative base: one `<base href>` and everything else beneath it.

Written by hand rather than built, as the module docstring says -- but the four things this file
now depends on are all present, because a fixture that dropped the base element would make the
rewrite untestable in exactly the place it matters.
"""

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


def _serving(bundle: Path, tmp_path: Path, database: Database, base_path: str = "") -> FastAPI:
    """An instance that carries a built interface, as the image does."""
    app = create_app(
        Settings(
            data_dir=tmp_path / "data",
            secret_key=SecretStr("0" * 64),
            transcription_base_url="http://whisper:8000/v1",
            static_dir=bundle,
            base_path=base_path,
        )
    )
    app.state.database = database
    return app


@pytest.fixture
def serving(bundle: Path, tmp_path: Path, database: Database) -> FastAPI:
    return _serving(bundle, tmp_path, database)


@pytest.fixture
def serving_on_a_subpath(bundle: Path, tmp_path: Path, database: Database) -> FastAPI:
    """The same image, behind a proxy that puts it at ``example.org/sonarium`` (``OPS-4``)."""
    return _serving(bundle, tmp_path, database, base_path="/sonarium")


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


def test_the_served_shell_says_which_prefix_it_is_under(serving_on_a_subpath: FastAPI) -> None:
    """The one thing that makes a relative bundle work on a subpath (``OPS-4``).

    The browser is at ``/sonarium/library/<uuid>`` and the shell asks for ``./assets/index.js``.
    Without a base element naming the deployment root, that resolves against the route and the
    page fetches nothing it needs -- which is the failure this whole task exists to close.
    """
    with TestClient(serving_on_a_subpath, root_path="/sonarium") as client:
        response = client.get("/library/8e29d6b4-0000-0000-0000-000000000000", headers=BROWSER)
    assert response.status_code == status.HTTP_200_OK
    assert '<base href="/sonarium/" />' in response.text


def test_the_shell_is_served_unchanged_on_a_subdomain(serving: FastAPI) -> None:
    """An unnecessary rewrite is its own kind of broken, and `/` is what the bundle already has."""
    with TestClient(serving) as client:
        response = client.get("/", headers=BROWSER)
    assert response.text == SHELL


@pytest.mark.parametrize("written", ["/sonarium", "sonarium", "/sonarium/", "sonarium/"])
def test_a_base_href_always_ends_in_a_slash(written: str) -> None:
    """``<base href="/sonarium">`` names a file, so the last segment is dropped and every asset
    resolves one level too high. It is one character and it is half the breakages."""
    rewritten = rebase(SHELL.encode(), Settings(base_path=written).base_path)
    assert b'<base href="/sonarium/" />' in rewritten


def test_the_rewrite_leaves_every_inline_script_byte_for_byte(bundle: Path) -> None:
    """The content policy names the theme bootstrap by hash, read off the file on disk.

    A rewrite that reached the script would change its hash, and the policy would then refuse the
    page it describes -- which fails as a blank screen with a console error and nothing at all in
    the server log. So the rewrite is asserted against the hash the policy is built from rather
    than against the text it produced.
    """
    from_disk = inline_script_hashes(bundle)
    served = SinglePageApp.discover(bundle, "/sonarium")
    assert served is not None
    assert script_hashes_of(served.shell) == from_disk
    assert len(from_disk) == 1


@pytest.mark.parametrize("proxy_strips", [False, True], ids=["passes-through", "strips"])
def test_a_browser_on_a_subpath_can_fetch_what_the_shell_asks_it_for(
    serving_on_a_subpath: FastAPI, proxy_strips: bool
) -> None:
    """The whole arrangement, resolved the way a browser resolves it (``OPS-4``).

    Read the base href out of the served page, resolve the bundle's relative ``src`` against it
    exactly as the browser would, and ask for the result. ``deploy/README.md`` documented this
    as tested while the answer was a 404, which is why it is asserted end to end rather than by
    reading the markup and believing it.

    Both proxy configurations, because the README offers both and they disagree about what the
    application sees: the prefix left on, or taken off with ``root_path`` carrying it. The
    second is the one that used to fail, and it failed only for the bundle -- every route
    answered, so nothing but a blank page said so.
    """
    deep = "/library/8e29d6b4-0000-0000-0000-000000000000"
    prefix = "" if proxy_strips else "/sonarium"
    with TestClient(serving_on_a_subpath, root_path="/sonarium") as client:
        shell = client.get(f"{prefix}{deep}", headers=BROWSER)
        base = re.search(r'<base href="([^"]+)"', shell.text)
        src = re.search(r'<script type="module" src="([^"]+)"', shell.text)
        assert base is not None and src is not None

        # What the browser puts in the address bar is the same either way: it is on the far side
        # of the proxy and has never heard of the arrangement.
        asked_for = urljoin(f"http://testserver/sonarium{deep}", urljoin(base[1], src[1]))
        assert asked_for == "http://testserver/sonarium/assets/index-abc123.js"

        forwarded = urlparse(asked_for).path
        served = client.get(forwarded.removeprefix("/sonarium") if proxy_strips else forwarded)
    assert served.status_code == status.HTTP_200_OK
    assert served.text == BUNDLE
    assert served.headers["cache-control"] == IMMUTABLE
