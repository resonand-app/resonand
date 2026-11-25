"""Who a library can be shared with (``DEC-29``, ``API-29``).

``DEC-29`` made this a directory on purpose, so what is tested is its edges: who is in it, who is
left out, and that it says nothing beyond what a share already says.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from resonand.db import users
from resonand.db.engine import Database

from tests.api.conftest import sign_in


def test_it_lists_every_other_account_by_name(client: TestClient, accounts: dict[str, int]) -> None:
    sign_in(client, "admin")
    listed = client.get("/users").json()
    assert [one["display_name"] for one in listed] == ["Friend", "Stranger"]


def test_the_caller_is_not_somebody_to_share_with(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    assert accounts["friend"] not in {one["id"] for one in client.get("/users").json()}


def test_each_entry_carries_what_a_share_already_says_and_no_more(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """``UserSummary`` and not ``AdminUser``: who runs the instance stays administration's."""
    sign_in(client, "friend")
    for one in client.get("/users").json():
        assert set(one) == {"id", "display_name", "email"}


def test_a_disabled_account_is_not_offered(
    client: TestClient, database: Database, accounts: dict[str, int]
) -> None:
    """The ACL resolves a disabled account to nothing, so offering it would offer a share that
    could never work."""
    with database.write_session() as session:
        users.set_disabled(session, accounts["stranger"], disabled=True)
    sign_in(client, "admin")
    assert [one["id"] for one in client.get("/users").json()] == [accounts["friend"]]


def test_names_sort_regardless_of_case_and_accents(
    client: TestClient, database: Database, accounts: dict[str, int]
) -> None:
    with database.write_session() as session:
        users.create_user(session, email="ana@example.test", display_name="ana")
        users.create_user(session, email="angela@example.test", display_name="Ángela Ruiz")
    sign_in(client, "admin")
    names = [one["display_name"] for one in client.get("/users").json()]
    assert names == ["ana", "Ángela Ruiz", "Friend", "Stranger"]


def test_it_needs_an_account(client: TestClient) -> None:
    assert client.get("/users").status_code == status.HTTP_401_UNAUTHORIZED
