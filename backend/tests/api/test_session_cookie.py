"""Whether the session cookie survives the connection it was handed to (``API-24``).

A browser discards a ``Secure`` cookie that arrived over plain HTTP, and says nothing about it. The
server sees a successful sign-in, the browser keeps no session, and the next request is answered
401 -- which the interface reads as the session ending and answers by returning to the sign-in
screen. From the person's side the credentials were simply ignored.

So the thing under test is never "was the header written". It is **whether the session works on the
request after the one that opened it**, which is the only question the old arrangement got wrong.

The scheme is taken from the request, because that is what the application is handed: uvicorn's
``ProxyHeadersMiddleware`` rewrites it from ``X-Forwarded-Proto`` for a peer inside
``--forwarded-allow-ips`` and ignores the header entirely for anybody else. Whether that trust is
configured correctly is uvicorn's concern and uvicorn's tests; these mount the application on each
scheme it can be handed and check what it does with it.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.core.config import CookieSecurity, Settings
from sonarium.db.models import Session as SessionRow
from sqlalchemy import func, select

from tests.api.conftest import PASSWORD, sign_in

if TYPE_CHECKING:
    from collections.abc import Sequence
    from pathlib import Path

    from sonarium.db.engine import Database

HTTPS = "https://testserver"
HTTP = "http://testserver"


def _instance(
    tmp_path: Path,
    database: Database,
    *,
    scheme: str,
    cookie_security: CookieSecurity,
) -> TestClient:
    """An instance as a browser on ``scheme`` reaches it.

    ``base_url`` is what sets ``scope["scheme"]``, which is exactly what a trusted proxy's
    ``X-Forwarded-Proto`` sets in front of a real server.
    """
    settings = Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        session_cookie_secure=cookie_security,
    )
    app = create_app(settings)
    app.state.database = database
    client = TestClient(app, base_url=f"{scheme}/api", raise_server_exceptions=False)
    client.__enter__()
    return client


def _credentials(name: str = "admin") -> dict[str, str]:
    return {"email": f"{name}@example.test", "password": PASSWORD}


def _kept_by_a_browser(set_cookie: Sequence[str], scheme: str) -> str:
    """The ``Cookie`` header a browser on ``scheme`` would send back, given these ``Set-Cookie``.

    ``TestClient``'s jar keeps a ``Secure`` cookie whatever the scheme was, which is the whole
    reason this defect reached a production instance: no test through the jar could see it,
    because the jar is more forgiving than every browser. So the rule is applied here instead --
    drop what a browser would drop, send what it would send.
    """
    kept: list[str] = []
    for header in set_cookie:
        pair, *attributes = header.split(";")
        marked = any(attribute.strip().lower() == "secure" for attribute in attributes)
        if marked and not scheme.startswith("https"):
            continue
        kept.append(pair.strip())
    return "; ".join(kept)


def _who_am_i(client: TestClient, set_cookie: Sequence[str], scheme: str) -> int:
    """Ask who is signed in, carrying only what a browser would still be holding."""
    client.cookies.clear()
    cookie = _kept_by_a_browser(set_cookie, scheme)
    return client.get("/auth/me", headers={"cookie": cookie} if cookie else {}).status_code


# --- The defect this exists to prevent -------------------------------------


def test_a_session_opened_over_plain_http_is_kept(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """The whole bug in one test: sign in, then ask who you are.

    Marking the cookie ``Secure`` here made the server answer 200 and the browser keep nothing,
    so the request after it was 401 and the interface went back to the sign-in screen with no
    message. An instance on a LAN address is the ordinary first run of a self-hosted thing.
    """
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="auto")
    opened = client.post("/auth/session", json=_credentials())
    assert opened.status_code == status.HTTP_200_OK
    assert _who_am_i(client, opened.headers.get_list("set-cookie"), HTTP) == status.HTTP_200_OK


def test_a_session_opened_over_https_is_kept(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    client = _instance(tmp_path, database, scheme=HTTPS, cookie_security="auto")
    opened = client.post("/auth/session", json=_credentials())
    assert opened.status_code == status.HTTP_200_OK
    assert _who_am_i(client, opened.headers.get_list("set-cookie"), HTTPS) == status.HTTP_200_OK


# --- What the attribute says -----------------------------------------------


@pytest.mark.parametrize(
    ("cookie_security", "scheme", "marked"),
    [
        ("auto", HTTPS, True),
        ("auto", HTTP, False),
        ("true", HTTPS, True),
        ("false", HTTPS, False),
        ("false", HTTP, False),
    ],
)
def test_the_cookie_is_marked_for_the_connection_it_crossed(
    tmp_path: Path,
    database: Database,
    accounts: dict[str, int],
    cookie_security: CookieSecurity,
    scheme: str,
    marked: bool,
) -> None:
    """``auto`` reads the connection; the other two pin the answer whatever it was."""
    client = _instance(tmp_path, database, scheme=scheme, cookie_security=cookie_security)
    response = client.post("/auth/session", json=_credentials())
    assert ("secure" in response.headers["set-cookie"].lower()) is marked


def test_signing_out_clears_a_cookie_it_marked(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """A browser will not let a response clear a ``Secure`` cookie with an unmarked deletion."""
    client = _instance(tmp_path, database, scheme=HTTPS, cookie_security="auto")
    sign_in(client, "admin")
    signed_out = client.delete("/auth/session")
    assert signed_out.status_code == status.HTTP_204_NO_CONTENT
    assert "secure" in signed_out.headers["set-cookie"].lower()
    assert client.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED


# --- An instance that says it is HTTPS -------------------------------------


def test_plain_http_sign_in_is_refused_rather_than_half_accepted(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """Under ``true`` the operator has said this instance is HTTPS, so this is a mistake.

    Answering 200 with a cookie the browser is about to discard is the worst of both: it reads as
    a wrong password, and the password crossed in clear to earn it.
    """
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="true")
    refused = client.post("/auth/session", json=_credentials())
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert refused.json()["type"] == "/errors/insecure_transport"
    assert "set-cookie" not in refused.headers


def test_a_refused_channel_opens_no_session(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """Refused before the password is read, so there is nothing to revoke afterwards."""
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="true")
    client.post("/auth/session", json=_credentials())
    with database.read_session() as session:
        assert session.execute(select(func.count()).select_from(SessionRow)).scalar_one() == 0


def test_the_first_run_refuses_a_clear_channel_too(tmp_path: Path, database: Database) -> None:
    """The administrator's password is chosen here. It is the last one to send in clear."""
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="true")
    refused = client.post(
        "/auth/bootstrap",
        json={"email": "first@example.test", "password": PASSWORD, "display_name": "First"},
    )
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert refused.json()["type"] == "/errors/insecure_transport"


def test_https_is_unaffected_by_the_refusal(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    client = _instance(tmp_path, database, scheme=HTTPS, cookie_security="true")
    opened = client.post("/auth/session", json=_credentials())
    assert opened.status_code == status.HTTP_200_OK
    assert _who_am_i(client, opened.headers.get_list("set-cookie"), HTTPS) == status.HTTP_200_OK


def test_a_refused_attempt_costs_nobody_their_budget(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """The refusal comes before the limiter, so it cannot be used to lock an address out."""
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="true")
    for _ in range(20):
        client.post("/auth/session", json=_credentials())
    secure = _instance(tmp_path, database, scheme=HTTPS, cookie_security="true")
    assert secure.post("/auth/session", json=_credentials()).status_code == status.HTTP_200_OK


# --- A proxy uvicorn did not trust -----------------------------------------


def _behind_a_container_proxy(
    tmp_path: Path, database: Database, *, cookie_security: CookieSecurity
) -> TestClient:
    """The instance as a second container reaches it: a bridge address, and plain HTTP inside.

    ``--forwarded-allow-ips`` defaults to ``127.0.0.1``, so uvicorn ignores this proxy's headers
    and the request arrives looking like plain HTTP. It is the shape most homelabs build.
    """
    settings = Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        session_cookie_secure=cookie_security,
    )
    app = create_app(settings)
    app.state.database = database
    client = TestClient(
        app,
        base_url=f"{HTTP}/api",
        client=("172.18.0.4", 5000),
        headers={"x-forwarded-proto": "https"},
        raise_server_exceptions=False,
    )
    client.__enter__()
    return client


def test_a_container_proxy_still_gets_a_marked_cookie(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """Without this the instance is properly behind TLS and hands out an unmarked session."""
    client = _behind_a_container_proxy(tmp_path, database, cookie_security="auto")
    opened = client.post("/auth/session", json=_credentials())
    assert opened.status_code == status.HTTP_200_OK
    assert "secure" in opened.headers["set-cookie"].lower()


def test_a_container_proxy_is_not_refused_by_an_https_instance(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """The browser is on HTTPS; only the last hop is not. Refusing it would be the wrong answer."""
    client = _behind_a_container_proxy(tmp_path, database, cookie_security="true")
    assert client.post("/auth/session", json=_credentials()).status_code == status.HTTP_200_OK


def test_a_peer_that_is_not_an_address_is_not_believed(
    tmp_path: Path, database: Database, accounts: dict[str, int]
) -> None:
    """``TestClient``'s own default peer is the name ``testclient``, which proves nothing."""
    client = _instance(tmp_path, database, scheme=HTTP, cookie_security="auto")
    opened = client.post(
        "/auth/session", json=_credentials(), headers={"x-forwarded-proto": "https"}
    )
    assert "secure" not in opened.headers["set-cookie"].lower()
