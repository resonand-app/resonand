"""The API skeleton: one error shape, one pagination envelope, a published document (``API-1``)."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

import pytest
from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.errors import PROBLEM_CONTENT_TYPE
from sonarium.api.logging import REQUEST_ID_HEADER
from sonarium.api.pagination import MAX_LIMIT, PageRequest, page_of, page_request
from sonarium.core.config import Settings, reset_settings_cache
from sonarium.core.errors import (
    ConflictError,
    InvalidRequestError,
    NotFoundError,
    PermissionDeniedError,
    ProviderError,
    UnauthenticatedError,
)
from sonarium.db.engine import Database


def test_the_instance_answers_without_a_session(origin_client: TestClient) -> None:
    body = origin_client.get("/").json()
    assert body["name"] == "sonarium"
    assert body["status"] == "ok"


def test_the_openapi_document_is_published(client: TestClient) -> None:
    """UI-3 generates its typed client from this, so it is part of the product, not a debug aid.

    It moved under ``/api`` with everything else it documents (``API-16``): a document at the
    origin would be the one path claiming the API still owns a name there.
    """
    document = client.get("/openapi.json").json()
    assert document["info"]["title"] == "Sonarium"
    assert document["info"]["license"]["name"] == "AGPL-3.0-only"


def test_a_request_carries_its_id_back(origin_client: TestClient) -> None:
    assert origin_client.get("/").headers[REQUEST_ID_HEADER]


def test_an_id_assigned_by_a_reverse_proxy_is_reused(origin_client: TestClient) -> None:
    """One request is one id end to end, or correlating anything is guesswork."""
    given = "proxy-assigned-id"
    response = origin_client.get("/", headers={REQUEST_ID_HEADER: given})
    assert response.headers[REQUEST_ID_HEADER] == given


@pytest.mark.parametrize(
    ("raised", "expected_status", "expected_code"),
    [
        (NotFoundError("no such recording"), status.HTTP_404_NOT_FOUND, "not_found"),
        (UnauthenticatedError("sign in"), status.HTTP_401_UNAUTHORIZED, "unauthenticated"),
        (PermissionDeniedError("read only"), status.HTTP_403_FORBIDDEN, "permission_denied"),
        (ConflictError("already there"), status.HTTP_409_CONFLICT, "conflict"),
        (InvalidRequestError("not an audio file"), status.HTTP_400_BAD_REQUEST, "invalid_request"),
        (ProviderError("whisper refused"), status.HTTP_502_BAD_GATEWAY, "provider_error"),
    ],
)
def test_every_deliberate_error_leaves_in_the_same_shape(
    app: FastAPI,
    settings: Settings,
    raised: Exception,
    expected_status: int,
    expected_code: str,
) -> None:
    @app.get("/failing")
    def failing() -> None:
        raise raised

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/failing")
    assert response.status_code == expected_status
    assert response.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)
    body = response.json()
    assert body["type"] == f"/errors/{expected_code}"
    assert body["status"] == expected_status
    assert body["detail"] == str(raised)
    assert body["title"]
    assert body["request_id"]


def test_an_unreadable_resource_is_a_404_and_says_nothing_more(app: FastAPI) -> None:
    """DEC-14: a 403 confirms the resource exists, which is what the ACL withholds."""

    @app.get("/hidden")
    def hidden() -> None:
        raise NotFoundError("no such recording")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/hidden")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "403" not in response.text


def test_an_unexpected_exception_gives_the_request_id_and_not_a_traceback(app: FastAPI) -> None:
    @app.get("/crashing")
    def crashing() -> None:
        raise RuntimeError("a secret internal detail")

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/crashing")
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    body = response.json()
    assert "a secret internal detail" not in response.text
    assert body["request_id"]
    assert "request id" in body["detail"]


def test_a_validation_failure_names_the_field_in_the_same_envelope(app: FastAPI) -> None:
    @app.get("/needs-a-number")
    def needs_a_number(count: int) -> dict[str, int]:
        return {"count": count}

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/needs-a-number", params={"count": "not-a-number"})
    body = response.json()
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert body["type"] == "/errors/invalid_request"
    assert body["errors"][0]["field"] == "count"


def test_an_unknown_route_uses_the_same_envelope(client: TestClient) -> None:
    response = client.get("/no-such-thing")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.headers["content-type"].startswith(PROBLEM_CONTENT_TYPE)


def test_a_page_carries_the_total_the_virtualised_list_needs() -> None:
    """UI-7 has to know how tall the list is before it has fetched it."""
    page = page_of(["a", "b"], total=800, request=PageRequest(limit=2, offset=0))
    assert page.total == 800
    assert page.has_more


def test_a_page_at_the_end_says_there_is_no_more() -> None:
    page = page_of(["z"], total=3, request=PageRequest(limit=2, offset=2))
    assert not page.has_more


PagedRequest = Annotated[PageRequest, Depends(page_request)]


def test_the_page_size_is_bounded(app: FastAPI) -> None:
    """An unbounded limit is a denial of service against your own instance."""

    @app.get("/paged")
    def paged(request: PagedRequest) -> dict[str, int]:
        return {"limit": request.limit}

    with TestClient(app, raise_server_exceptions=False) as client:
        assert client.get("/paged").json()["limit"] == 50
        assert client.get("/paged", params={"limit": MAX_LIMIT}).status_code == status.HTTP_200_OK
        too_many = client.get("/paged", params={"limit": MAX_LIMIT + 1})
    assert too_many.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_a_subpath_instance_publishes_its_document_under_that_path(
    tmp_path_factory: pytest.TempPathFactory, database: Database
) -> None:
    """OPS-4: the subpath is the one that always ends up broken."""

    subpath_settings = Settings(
        data_dir=tmp_path_factory.mktemp("subpath"),
        secret_key=SecretStr("0" * 64),
        transcription_base_url="http://whisper:8000/v1",
        base_path="/sonarium",
    )
    app = create_app(subpath_settings)
    app.state.database = database
    assert app.root_path == "/sonarium"
    with TestClient(app, root_path="/sonarium") as client:
        assert client.get("/api/openapi.json").json()["servers"][0]["url"] == "/sonarium"


class _RecordedLog:
    """Whatever the lifespan logged, as (level, event, fields).

    Against the module's logger rather than the rendered output, because the application
    configures structlog with ``cache_logger_on_first_use``: a logger bound by an earlier test
    keeps that test's renderer, and an assertion on the printed line would pass or fail on the
    order the suite happened to run in.
    """

    def __init__(self) -> None:
        self.entries: list[tuple[str, str, dict[str, object]]] = []

    def info(self, event: str, **fields: object) -> None:
        self.entries.append(("info", event, fields))

    def warning(self, event: str, **fields: object) -> None:
        self.entries.append(("warning", event, fields))

    def error(self, event: str, **fields: object) -> None:
        self.entries.append(("error", event, fields))

    def of(self, event: str) -> list[tuple[str, str, dict[str, object]]]:
        return [entry for entry in self.entries if entry[1] == event]


def _start(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> _RecordedLog:
    """Run one instance through its whole lifespan and return what it said on the way up."""
    recorded = _RecordedLog()
    monkeypatch.setattr("sonarium.api.app._logger", recorded)
    with TestClient(create_app(settings)):
        pass
    return recorded


def test_the_startup_line_says_where_the_worker_is(
    tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``REV-8``: the topology was the one thing ``instance.starting`` did not state.

    An operator reading the log saw the version and the paths, and nothing about how many
    processes may write -- which is the invariant the whole of ``DAT-2`` rests on.
    """
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("with-worker"),
        secret_key=SecretStr("0" * 64),
    )
    _level, _event, fields = _start(settings, monkeypatch).of("instance.starting")[0]
    assert fields["worker"] == "in-process"


def test_turning_the_worker_off_is_loud_about_what_it_does_not_license(
    tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``REV-11``: the one configuration from which somebody reaches a second writer.

    Nothing can stop them from the outside -- the lock is in this process's memory and the other
    process would never see it -- so the sentence belongs in the log of the one turned down.
    """
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("no-worker"),
        secret_key=SecretStr("0" * 64),
        run_worker=False,
    )
    started = _start(settings, monkeypatch)
    assert started.of("instance.starting")[0][2]["worker"] == "off"
    warned = started.of("instance.worker_disabled")
    assert len(warned) == 1
    assert warned[0][0] == "warning"
    assert "not a supported topology" in str(warned[0][2]["note"])


def test_an_ordinary_instance_does_not_warn_about_a_topology_it_is_not_in(
    tmp_path_factory: pytest.TempPathFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    settings = Settings(
        data_dir=tmp_path_factory.mktemp("ordinary"),
        secret_key=SecretStr("0" * 64),
    )
    started = _start(settings, monkeypatch)
    assert started.of("instance.worker_disabled") == []
    assert started.of("instance.starting") != []


@pytest.fixture
def _forget_cached_settings() -> Iterator[None]:
    """``get_settings`` is cached for the process, and these tests write the environment."""
    reset_settings_cache()
    yield
    reset_settings_cache()


@pytest.mark.usefixtures("_forget_cached_settings")
def test_an_instance_read_from_the_environment_says_what_is_missing_and_stops(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``OPS-3``. ``deploy/.env.example`` ships ``SONARIUM_SECRET_KEY=`` empty, which pydantic
    reads as a zero-length secret rather than as absent -- so the instance used to start and sign
    every playback token with nothing."""
    monkeypatch.setenv("SONARIUM_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SONARIUM_SECRET_KEY", "")
    recorded = _RecordedLog()
    monkeypatch.setattr("sonarium.api.app._logger", recorded)

    with pytest.raises(SystemExit):
        create_app()

    refused = recorded.of("configuration.refused")
    assert [str(fields["problem"]) for _level, _event, fields in refused], "it says what to fix"
    assert any("SONARIUM_SECRET_KEY" in str(fields["problem"]) for *_, fields in refused)


@pytest.mark.usefixtures("_forget_cached_settings")
def test_an_instance_with_nowhere_to_transcribe_still_starts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The archive is the product; transcription is a feature of it. Refusing to boot here would
    turn one missing endpoint into an archive nobody can reach."""
    monkeypatch.setenv("SONARIUM_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SONARIUM_SECRET_KEY", "0" * 64)
    monkeypatch.delenv("SONARIUM_TRANSCRIPTION_BASE_URL", raising=False)
    recorded = _RecordedLog()
    monkeypatch.setattr("sonarium.api.app._logger", recorded)

    app = create_app()

    assert app.title == "Sonarium"
    said = recorded.of("configuration.incomplete")
    assert any("SONARIUM_TRANSCRIPTION_BASE_URL" in str(fields["detail"]) for *_, fields in said)


def test_settings_handed_in_are_never_asked_for_a_signing_key(
    tmp_path_factory: pytest.TempPathFactory,
) -> None:
    """Only the branch that reads the environment is checked. Checking both would have made this
    a change to every test in the suite that builds an app without a secret."""
    app = create_app(Settings(data_dir=tmp_path_factory.mktemp("handed-in")))
    assert app.title == "Sonarium"
