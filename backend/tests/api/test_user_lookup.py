"""Finding one person to share with (``API-15``, ``UI-17d``).

Every test here is about the endpoint refusing to be a directory. That is not a side condition:
a prefix or name search would let anybody holding manage on one library enumerate every account
on the instance, so the narrowness *is* the design, and the tests that matter are the ones that
fail if it widens.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.db import users
from sonarium.db.engine import Database

from tests.api.conftest import sign_in


def test_a_full_address_finds_exactly_one_account(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    found = client.get("/users/lookup", params={"email": "friend@example.test"}).json()
    assert len(found) == 1
    assert found[0]["id"] == accounts["friend"]


def test_the_result_carries_what_sharing_needs_and_no_more(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """``PUT /shares`` takes an account id, which is the reason this endpoint exists at all."""
    sign_in(client, "admin")
    found = client.get("/users/lookup", params={"email": "friend@example.test"}).json()[0]
    assert set(found) == {"id", "display_name", "email"}


def test_a_partial_address_finds_nobody(client: TestClient, accounts: dict[str, int]) -> None:
    """The test the whole shape exists for. A prefix search here would be a way to walk the
    instance's accounts one letter at a time."""
    sign_in(client, "admin")
    for partial in ("friend", "friend@example", "@example.test", "f"):
        answered = client.get("/users/lookup", params={"email": partial})
        assert answered.status_code in {
            status.HTTP_200_OK,
            status.HTTP_422_UNPROCESSABLE_CONTENT,
        }, partial
        if answered.status_code == status.HTTP_200_OK:
            assert answered.json() == [], partial


def test_a_name_is_not_searchable(client: TestClient, accounts: dict[str, int]) -> None:
    """Refused before it is looked up at all: without an ``@`` it is not an address, and the
    schema says so. A bare display name never reaches the query."""
    sign_in(client, "admin")
    refused = client.get("/users/lookup", params={"email": "friend"})
    assert refused.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_an_address_nobody_has_is_an_empty_list_rather_than_an_error(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """ "No account has that address" is a state the form draws under the field, not a failure."""
    sign_in(client, "admin")
    answered = client.get("/users/lookup", params={"email": "nobody@example.test"})
    assert answered.status_code == status.HTTP_200_OK
    assert answered.json() == []


def test_the_address_matches_however_it_was_typed(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Somebody reading an address off a note types it as they see it; identity is decided on the
    normalised form."""
    sign_in(client, "admin")
    found = client.get("/users/lookup", params={"email": "  Friend@Example.TEST  "}).json()
    assert len(found) == 1
    assert found[0]["id"] == accounts["friend"]


def test_a_disabled_account_is_not_offered(
    client: TestClient, database: Database, accounts: dict[str, int]
) -> None:
    """The ACL resolves a disabled account to nothing, so returning one would offer a share that
    could never work."""
    with database.write_session() as session:
        users.set_disabled(session, accounts["friend"], disabled=True)
    sign_in(client, "admin")
    assert client.get("/users/lookup", params={"email": "friend@example.test"}).json() == []


def test_it_needs_an_account(client: TestClient) -> None:
    assert (
        client.get("/users/lookup", params={"email": "friend@example.test"}).status_code
        == status.HTTP_401_UNAUTHORIZED
    )


def test_managing_a_library_is_what_it_takes_and_everybody_does(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """Worth stating plainly: every account owns its personal library at level 40, so this gate
    passes for everybody. It is not the protection -- the full-address match is."""
    sign_in(client, "stranger")
    assert (
        client.get("/users/lookup", params={"email": "friend@example.test"}).status_code
        == status.HTTP_200_OK
    )
