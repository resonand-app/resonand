"""Trashed libraries, and the facts the interface reads off the instance (``API-14``).

Two halves of one gap. ``INT-1`` shows **one** list with a type marker -- the question somebody
has is where a thing went, not whether it was a library -- and it shows how long each item has
left. Neither was possible: trashed libraries could not be listed at all, and the retention was
on the administrator-only status endpoint, so the people who most need to know how long they have
were the ones who could not be told.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core import formats
from sonarium.core.levels import Level
from sonarium.db import libraries as library_repo
from sonarium.db.engine import Database

from tests.api.conftest import sign_in

# --- Trashed libraries ----------------------------------------------------


def test_a_trashed_library_can_be_listed(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    assert client.delete(f"/libraries/{owner_library}").status_code == status.HTTP_204_NO_CONTENT
    listed = client.get("/trash/libraries").json()
    assert listed["total"] == 1
    assert listed["items"][0]["uuid"] == owner_library
    assert listed["items"][0]["deleted_at"] is not None


def test_a_library_that_is_not_trashed_is_not_in_the_trash(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    assert client.get("/trash/libraries").json()["total"] == 0


def test_the_trash_puts_the_closest_to_being_purged_first(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    """The same order as ``/trash/audio``, so merging the two client-side is a sort on one key."""
    sign_in(client, "admin")
    second = client.post("/libraries", json={"name": "Interviews"}).json()["uuid"]
    client.delete(f"/libraries/{owner_library}")
    client.delete(f"/libraries/{second}")
    listed = client.get("/trash/libraries").json()["items"]
    assert [row["uuid"] for row in listed] == [owner_library, second]


def test_somebody_who_could_only_read_it_is_not_told_it_is_going(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Level 30, the same as trashing one. A reader has no business being told it is on its way
    out, and would be able to do nothing about it if they were."""
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "admin")
    client.delete(f"/libraries/{owner_library}")
    client.delete("/auth/session")
    sign_in(client, "friend")
    assert client.get("/trash/libraries").json()["total"] == 0


def test_a_restored_library_leaves_the_trash(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    client.delete(f"/libraries/{owner_library}")
    client.post(f"/libraries/{owner_library}/restore")
    assert client.get("/trash/libraries").json()["total"] == 0


def test_the_trash_needs_an_account(client: TestClient) -> None:
    assert client.get("/trash/libraries").status_code == status.HTTP_401_UNAUTHORIZED


# --- What the instance says about itself ----------------------------------


def test_everybody_can_be_told_how_long_the_trash_keeps_things(client: TestClient) -> None:
    """It was on ``/admin/status``, so ``INT-1``'s "time left" could be shown to administrators
    and to nobody else."""
    assert client.get("/instance").json()["trash_retention_days"] == 30


def test_the_upload_limit_and_the_formats_are_readable_before_signing_in(
    client: TestClient,
) -> None:
    """``UI-18a`` states both before somebody picks a file, and is told to read them rather than
    hard-code them. ``/instance`` is the one call made without a session, which is where the
    upload dialog's defaults have to come from on a cold load."""
    reported = client.get("/instance").json()
    assert reported["max_upload_bytes"] > 0
    assert ".m4a" in reported["accepted_extensions"]
    assert ".mp4" in reported["video_extensions"]


def test_the_reported_formats_are_the_ones_that_are_actually_accepted(
    client: TestClient,
) -> None:
    """A published list that disagreed with the ingest check would refuse a file the dialog had
    just said was fine."""
    reported = client.get("/instance").json()
    assert set(reported["accepted_extensions"]) == set(formats.ACCEPTED_EXTENSIONS)
    assert all(formats.is_accepted(f"recording{ext}") for ext in reported["accepted_extensions"])
    assert set(reported["video_extensions"]) <= set(reported["accepted_extensions"])


def test_the_instance_still_says_nothing_about_who_is_on_it(client: TestClient) -> None:
    """It is answered without a session, so what it carries has to stay facts about the instance
    rather than about the people using it."""
    reported = client.get("/instance").json()
    assert set(reported) == {
        "name",
        "version",
        "needs_bootstrap",
        "trash_retention_days",
        "max_upload_bytes",
        "accepted_extensions",
        "video_extensions",
    }
