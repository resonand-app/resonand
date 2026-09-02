"""Fixtures for the API skeleton. Database fixtures live in the root conftest."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.core.config import Settings


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    """A runnable instance that writes nowhere but a temporary directory."""
    return Settings(
        data_dir=tmp_path,
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        log_format="console",
    )


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
