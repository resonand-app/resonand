"""Fixtures for the API skeleton. Database fixtures live in the root conftest."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Protocol

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.security import hash_password
from sonarium.core.config import Settings
from sonarium.db import libraries as library_repo
from sonarium.db import users as user_repo
from sonarium.db.engine import Database

PASSWORD = "a-long-enough-password"


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    """A runnable instance that writes nowhere but a temporary directory."""
    return Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        log_format="console",
        session_cookie_secure=False,
    )


@pytest.fixture
def app(settings: Settings, database: Database) -> FastAPI:
    """The application against a temporary archive.

    The database is put on the application state rather than injected through
    ``dependency_overrides``, so the tests exercise the same resolution path the container
    does instead of a second one that only exists for them.
    """
    built = create_app(settings)
    built.state.database = database
    return built


@pytest.fixture
def accounts(database: Database) -> dict[str, int]:
    """An administrator, a collaborator and a stranger, all with the same password."""
    made: dict[str, int] = {}
    with database.write_session() as session:
        for name, is_admin in (("admin", True), ("friend", False), ("stranger", False)):
            user = user_repo.create_user(
                session,
                email=f"{name}@example.test",
                display_name=name.title(),
                password_hash=hash_password(PASSWORD),
                is_admin=is_admin,
            )
            made[name] = user.id
    return made


def sign_in(client: TestClient, name: str) -> None:
    """Put a session cookie on the client, the way a browser would."""
    response = client.post(
        "/auth/session", json={"email": f"{name}@example.test", "password": PASSWORD}
    )
    assert response.status_code == 200, response.text


@pytest.fixture
def owner_library(database: Database, accounts: dict[str, int]) -> str:
    """A library owned by the administrator, with nothing in it yet."""
    with database.write_session() as session:
        library = library_repo.create_library(
            session, accounts["admin"], name="Family", description="Recordings that matter."
        )
        return library.uuid


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


class ClientFactory(Protocol):
    """Opens another browser against the same instance, with its own cookie jar."""

    def __call__(self) -> TestClient: ...


@pytest.fixture
def app_client_factory(app: FastAPI) -> Iterator[ClientFactory]:
    """A second and third client, for the tests about sessions being separate things."""
    opened: list[TestClient] = []

    def make() -> TestClient:
        client = TestClient(app, raise_server_exceptions=False)
        client.__enter__()
        opened.append(client)
        return client

    yield make
    for client in opened:
        client.__exit__(None, None, None)


@pytest.fixture
def settings_cookie_name(settings: Settings) -> str:
    return settings.session_cookie_name
