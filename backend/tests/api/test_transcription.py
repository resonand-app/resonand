"""The transcription destination, readable by anybody (``API-12``, ``UI-25``).

Principle 2 says nothing leaves the instance without saying so first. The test that matters is
not that the endpoint answers, but that it answers **the people it protects** -- a disclosure only
administrators can read is not a disclosure.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.core.config import Settings
from sonarium.db.engine import Database

from tests.api.conftest import sign_in


def test_a_non_admin_is_told_where_their_audio_goes(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """The whole reason this endpoint exists.

    ``GET /admin/transcription`` answers 403 here, which left the people whose recordings are
    being sent somewhere as the only ones who could not find out.
    """
    sign_in(client, "friend")
    assert client.get("/admin/transcription").status_code == status.HTTP_403_FORBIDDEN

    reported = client.get("/transcription/destination")
    assert reported.status_code == status.HTTP_200_OK
    assert reported.json()["host"] == "whisper:8000"


def test_an_administrator_is_told_exactly_the_same_thing(
    client: TestClient, app_client_factory: object, accounts: dict[str, int]
) -> None:
    """One disclosure, not a privileged version and a public one."""
    sign_in(client, "friend")
    as_friend = client.get("/transcription/destination").json()
    client.delete("/auth/session")
    sign_in(client, "admin")
    assert client.get("/transcription/destination").json() == as_friend


def test_it_reports_the_provider_and_places_it(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    reported = client.get("/transcription/destination").json()
    assert reported["provider"] == "openai-compatible"
    assert reported["configured"] is True
    assert reported["is_local"] is True, "a compose service name is on this network"


def test_it_says_nothing_beyond_what_the_disclosure_needs(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """No credential, no flag about one, no base URL -- a base URL can carry auth in its userinfo.

    Written as an exact key set rather than a handful of absences, so that a field added to the
    schema later has to be considered here rather than shipping quietly to every caller.
    """
    sign_in(client, "friend")
    reported = client.get("/transcription/destination").json()
    assert set(reported) == {"provider", "host", "is_local", "configured"}


def test_the_credential_is_never_reported_in_any_form(
    tmp_path_factory: pytest.TempPathFactory, database: Database, accounts: dict[str, int]
) -> None:
    secret = "sk-a-secret-nobody-should-see"
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("keyed"),
        secret_key=SecretStr("0" * 64),
        transcription_base_url=f"https://someone:{secret}@whisper.example.com/v1",
        transcription_api_key=SecretStr(secret),
        session_cookie_secure=False,
    )
    app = create_app(settings)
    app.state.database = database
    with TestClient(app, raise_server_exceptions=False) as keyed:
        sign_in(keyed, "friend")
        response = keyed.get("/transcription/destination")
    assert secret not in response.text
    assert response.json()["host"] == "whisper.example.com"


def test_no_provider_configured_is_a_state_and_not_an_error(
    tmp_path_factory: pytest.TempPathFactory, database: Database, accounts: dict[str, int]
) -> None:
    """``UI-25b``'s fourth case: nothing on this instance can be transcribed, said plainly."""
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("bare"),
        secret_key=SecretStr("0" * 64),
        session_cookie_secure=False,
    )
    app = create_app(settings)
    app.state.database = database
    with TestClient(app, raise_server_exceptions=False) as bare:
        sign_in(bare, "friend")
        reported = bare.get("/transcription/destination")
    assert reported.status_code == status.HTTP_200_OK
    assert reported.json() == {
        "provider": "openai-compatible",
        "host": None,
        "is_local": False,
        "configured": False,
    }


def test_it_still_needs_an_account(client: TestClient) -> None:
    """Any *authenticated* caller. It describes an instance, not the public internet."""
    assert client.get("/transcription/destination").status_code == status.HTTP_401_UNAUTHORIZED


def test_reading_it_contacts_nothing(
    client: TestClient, accounts: dict[str, int], monkeypatch: pytest.MonkeyPatch
) -> None:
    """A page that quietly contacted the provider would be a smaller version of the egress this
    endpoint exists to disclose."""

    def refuse(*_: object, **__: object) -> httpx.Response:
        raise AssertionError("the destination endpoint reached out to something")

    monkeypatch.setattr(httpx, "get", refuse)
    monkeypatch.setattr(httpx, "post", refuse)
    sign_in(client, "friend")
    assert client.get("/transcription/destination").status_code == status.HTTP_200_OK
