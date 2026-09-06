"""Signing in, sessions and the first run (``API-3``, ``API-7``)."""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core.config import Settings
from sonarium.db import users
from sonarium.db.engine import Database

from tests.api.conftest import PASSWORD, ClientFactory, sign_in


def test_a_fresh_instance_asks_to_be_bootstrapped(client: TestClient) -> None:
    """The sign-in screen needs this before anybody has signed in (``UI-21``)."""
    assert client.get("/instance").json()["needs_bootstrap"] is True


def test_the_first_account_created_is_an_administrator(client: TestClient) -> None:
    response = client.post(
        "/auth/bootstrap",
        json={
            "email": "first@example.test",
            "password": "a-long-enough-password",
            "display_name": "First",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["is_admin"] is True
    assert client.get("/instance").json()["needs_bootstrap"] is False


def test_bootstrap_is_not_a_way_in_afterwards(client: TestClient, accounts: dict[str, int]) -> None:
    """The first run is the only moment an instance has nobody to authorise the request."""
    response = client.post(
        "/auth/bootstrap",
        json={"email": "second@example.test", "password": PASSWORD, "display_name": "Second"},
    )
    assert response.status_code == status.HTTP_409_CONFLICT


def test_bootstrap_signs_the_new_administrator_in(client: TestClient) -> None:
    client.post(
        "/auth/bootstrap",
        json={"email": "first@example.test", "password": PASSWORD, "display_name": "First"},
    )
    assert client.get("/auth/me").status_code == status.HTTP_200_OK


def test_signing_in_gives_a_cookie_that_is_not_readable_by_script(
    client: TestClient, accounts: dict[str, int], settings_cookie_name: str
) -> None:
    response = client.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert response.status_code == status.HTTP_200_OK
    header = response.headers["set-cookie"]
    assert "httponly" in header.lower()
    assert "samesite=lax" in header.lower()


def test_a_wrong_password_and_an_unknown_address_give_the_same_answer(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Two answers would make the sign-in form an oracle for which addresses have accounts."""
    wrong_password = client.post(
        "/auth/session", json={"email": "admin@example.test", "password": "not the password"}
    )
    unknown = client.post(
        "/auth/session", json={"email": "nobody@example.test", "password": PASSWORD}
    )
    assert wrong_password.status_code == unknown.status_code
    assert wrong_password.json()["detail"] == unknown.json()["detail"]


def test_a_disabled_account_cannot_sign_in_and_is_not_told_why(
    client: TestClient, database: Database, accounts: dict[str, int]
) -> None:
    with database.write_session() as session:
        users.set_disabled(session, accounts["friend"], disabled=True)
    response = client.post(
        "/auth/session", json={"email": "friend@example.test", "password": PASSWORD}
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "disabled" not in response.text.lower()


def test_an_address_signs_in_whichever_way_it_is_typed(
    client: TestClient, accounts: dict[str, int]
) -> None:
    response = client.post(
        "/auth/session", json={"email": "ADMIN@Example.test", "password": PASSWORD}
    )
    assert response.status_code == status.HTTP_200_OK


def test_without_a_cookie_everything_private_is_refused(client: TestClient) -> None:
    assert client.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.get("/libraries").status_code == status.HTTP_401_UNAUTHORIZED


def test_a_made_up_cookie_is_refused_exactly_like_a_missing_one(client: TestClient) -> None:
    client.cookies.set("sonarium_session", "invented")
    refused = client.get("/auth/me")
    assert refused.status_code == status.HTTP_401_UNAUTHORIZED


def test_signing_out_ends_that_session(client: TestClient, accounts: dict[str, int]) -> None:
    sign_in(client, "admin")
    assert client.delete("/auth/session").status_code == status.HTTP_204_NO_CONTENT
    assert client.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED


def test_an_account_can_see_and_revoke_its_own_sessions(
    client: TestClient, accounts: dict[str, int], app_client_factory: ClientFactory
) -> None:
    """UI-20 promises this list, and a stateless signed cookie could not have delivered it."""
    other = app_client_factory()
    sign_in(other, "admin")
    sign_in(client, "admin")
    listed = client.get("/auth/sessions").json()
    assert len(listed) == 2
    theirs = next(row for row in listed if not row["is_current"])
    assert client.delete(f"/auth/sessions/{theirs['id']}").status_code == 204
    assert other.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.get("/auth/me").status_code == status.HTTP_200_OK


def test_signing_out_everywhere_else_keeps_the_current_session(
    client: TestClient, accounts: dict[str, int], app_client_factory: ClientFactory
) -> None:
    other = app_client_factory()
    sign_in(other, "admin")
    sign_in(client, "admin")
    assert client.delete("/auth/sessions").status_code == 204
    assert other.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.get("/auth/me").status_code == status.HTTP_200_OK


def test_changing_a_password_ends_every_other_session(
    client: TestClient, accounts: dict[str, int], app_client_factory: ClientFactory
) -> None:
    """Leaving them alive would make changing a password decorative."""
    other = app_client_factory()
    sign_in(other, "admin")
    sign_in(client, "admin")
    response = client.post(
        "/auth/password",
        json={"current_password": PASSWORD, "new_password": "a-different-long-password"},
    )
    assert response.status_code == 204
    assert other.get("/auth/me").status_code == status.HTTP_401_UNAUTHORIZED
    assert client.get("/auth/me").status_code == status.HTTP_200_OK


def test_the_new_password_is_the_one_that_works(
    client: TestClient, accounts: dict[str, int], app_client_factory: ClientFactory
) -> None:
    sign_in(client, "admin")
    client.post(
        "/auth/password",
        json={"current_password": PASSWORD, "new_password": "a-different-long-password"},
    )
    fresh = app_client_factory()
    assert (
        fresh.post(
            "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        fresh.post(
            "/auth/session",
            json={"email": "admin@example.test", "password": "a-different-long-password"},
        ).status_code
        == status.HTTP_200_OK
    )


def test_the_wrong_current_password_changes_nothing(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    response = client.post(
        "/auth/password",
        json={"current_password": "wrong", "new_password": "a-different-long-password"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_a_short_password_is_refused_before_it_is_hashed(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    response = client.post(
        "/auth/password", json={"current_password": PASSWORD, "new_password": "short"}
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_a_password_never_appears_in_a_response(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    assert PASSWORD not in client.get("/auth/me").text
    assert PASSWORD not in client.get("/auth/sessions").text


def test_grinding_through_a_password_list_is_slowed_down(
    client: TestClient, accounts: dict[str, int], settings: Settings
) -> None:
    """INT-5. In-process and honest about it: this makes guessing slow, it is not a boundary."""
    for _ in range(settings.login_attempts_per_minute):
        client.post("/auth/session", json={"email": "admin@example.test", "password": "no"})
    blocked = client.post(
        "/auth/session", json={"email": "admin@example.test", "password": PASSWORD}
    )
    assert blocked.json()["type"] == "/errors/too_many_requests"


# --- Changing your own account --------------------------------------------


def test_a_display_name_can_be_changed(client: TestClient, accounts: dict[str, int]) -> None:
    sign_in(client, "admin")
    changed = client.patch("/auth/me", json={"display_name": "Gabriel"})
    assert changed.status_code == status.HTTP_200_OK
    assert changed.json()["display_name"] == "Gabriel"
    assert client.get("/auth/me").json()["display_name"] == "Gabriel"


def test_each_field_is_changed_on_its_own(client: TestClient, accounts: dict[str, int]) -> None:
    """Everything absent means "leave this alone", so the settings view can save one section
    without sending back the ones it is not editing."""
    sign_in(client, "admin")
    before = client.get("/auth/me").json()
    client.patch("/auth/me", json={"language": "ca"})
    after = client.get("/auth/me").json()
    assert after["language"] == "ca"
    assert after["display_name"] == before["display_name"]
    assert after["email"] == before["email"]


def test_a_language_round_trips_and_can_be_cleared(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """UI-20d ships a working single-option select, so the round trip is the thing being proved.

    Clearing is asked for explicitly, because absent already means "leave it" and following the
    instance's language has to stay reachable.
    """
    sign_in(client, "admin")
    assert client.get("/auth/me").json()["language"] is None
    assert client.patch("/auth/me", json={"language": "en"}).json()["language"] == "en"
    assert client.patch("/auth/me", json={"clear_language": True}).json()["language"] is None


def test_an_address_already_in_use_is_a_conflict(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Against `email_normalised`, which is the key identity is decided on."""
    sign_in(client, "admin")
    clash = client.patch("/auth/me", json={"email": "friend@example.test"})
    assert clash.status_code == status.HTTP_409_CONFLICT
    assert "already exists" in clash.json()["detail"]


def test_the_conflict_is_on_the_normalised_form_not_the_typed_one(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """A differently-cased version of somebody else's address is the same account."""
    sign_in(client, "admin")
    clash = client.patch("/auth/me", json={"email": "Friend@Example.TEST"})
    assert clash.status_code == status.HTTP_409_CONFLICT


def test_changing_to_your_own_address_is_not_a_conflict(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Saving a form without touching the address must not refuse."""
    sign_in(client, "admin")
    assert client.patch("/auth/me", json={"email": "admin@example.test"}).status_code == 200


def test_a_changed_address_is_the_one_that_signs_in(
    client: TestClient, app_client_factory: ClientFactory, accounts: dict[str, int]
) -> None:
    """The point of re-deriving the key rather than only storing the typed form."""
    sign_in(client, "admin")
    client.patch("/auth/me", json={"email": "Gabriel@Example.Test"})
    other = app_client_factory()
    signed_in = other.post(
        "/auth/session", json={"email": "gabriel@example.test", "password": PASSWORD}
    )
    assert signed_in.status_code == status.HTTP_200_OK


def test_you_cannot_make_yourself_an_administrator(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """`extra="forbid"` on the schema is what enforces it, so this is the test that it is on."""
    sign_in(client, "friend")
    refused = client.patch("/auth/me", json={"is_admin": True})
    assert refused.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.get("/auth/me").json()["is_admin"] is False


def test_changing_your_account_needs_an_account(client: TestClient) -> None:
    assert (
        client.patch("/auth/me", json={"display_name": "Nobody"}).status_code
        == status.HTTP_401_UNAUTHORIZED
    )
