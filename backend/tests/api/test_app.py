"""The API skeleton: one error shape, one pagination envelope, a published document (``API-1``)."""

from __future__ import annotations

from typing import Annotated

import pytest
from fastapi import Depends, FastAPI, status
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sonarium.api.app import create_app
from sonarium.api.errors import PROBLEM_CONTENT_TYPE
from sonarium.api.logging import REQUEST_ID_HEADER
from sonarium.api.pagination import MAX_LIMIT, PageRequest, page_of, page_request
from sonarium.core.config import Settings
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
