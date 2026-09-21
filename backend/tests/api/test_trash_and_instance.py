"""Trashed libraries, and the facts the interface reads off the instance (``API-14``).

Two halves of one gap. ``INT-1`` shows **one** list with a type marker -- the question somebody
has is where a thing went, not whether it was a library -- and it shows how long each item has
left. Neither was possible: trashed libraries could not be listed at all, and the retention was
on the administrator-only status endpoint, so the people who most need to know how long they have
were the ones who could not be told.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import status
from fastapi.testclient import TestClient
from resonand.core import formats
from resonand.core.config import Settings
from resonand.core.levels import DESCRIPTIONS, GRANTABLE, Level
from resonand.db import libraries as library_repo
from resonand.db.audio import create_audio
from resonand.db.engine import Database
from resonand.media import storage

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
        "levels",
    }


def test_the_instance_names_every_level_a_share_may_carry(client: TestClient) -> None:
    """``API-18``. `ShareSummary.level_description` describes the levels **in use**, so a library
    shared with one person at `edit` explained that one and left the two somebody might change
    *to* with nothing to render."""
    reported = client.get("/instance").json()
    assert [row["level"] for row in reported["levels"]] == [int(one) for one in GRANTABLE]
    assert [row["description"] for row in reported["levels"]] == [
        DESCRIPTIONS[one] for one in GRANTABLE
    ]


def test_the_instance_does_not_offer_owner_as_something_to_grant(client: TestClient) -> None:
    """It is read off `library.owner_id`, a CHECK refuses a share row carrying it, and `UI-34c`
    says not to draw an option nobody can pick."""
    reported = client.get("/instance").json()
    assert Level.OWNER not in [row["level"] for row in reported["levels"]]


# --- Emptying the trash now (``API-19``) ----------------------------------


def _a_recording(
    database: Database, accounts: dict[str, int], library_uuid: str, *, title: str = "Note"
) -> str:
    """A recording in a library, with a real file under it."""
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, accounts["admin"])
            if row[0].uuid == library_uuid
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=accounts["admin"],
            storage_path="",
            original_filename=f"{title}.m4a",
            title=title,
        )
        return audio.uuid


def _with_bytes(settings: Settings, audio_uuid: str) -> Path:
    """Put a real original under a recording, so a purge has files to remove."""
    path, _ = storage.store_original(
        settings.resolved_storage_dir, audio_uuid, [b"bytes"], filename="note.m4a"
    )
    return path


def test_a_trashed_recording_can_be_destroyed_now(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """``INT-1c``: the trash is recoverable until somebody decides it is not."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    _with_bytes(settings, audio_uuid)
    sign_in(client, "admin")
    assert client.delete(f"/audio/{audio_uuid}").status_code == status.HTTP_204_NO_CONTENT
    assert client.delete(f"/trash/audio/{audio_uuid}").status_code == status.HTTP_204_NO_CONTENT
    assert client.get("/trash/audio").json()["total"] == 0
    assert client.get(f"/audio/{audio_uuid}").status_code == status.HTTP_404_NOT_FOUND
    assert not storage.recording_dir(settings.resolved_storage_dir, audio_uuid).exists()


def test_a_recording_that_is_not_in_the_trash_cannot_be_destroyed(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """404 and not 400, because permanent deletion is reachable only from the screen that lists
    what it would destroy -- and a bad request would confirm the recording exists (``DEC-14``)."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    sign_in(client, "admin")
    assert client.delete(f"/trash/audio/{audio_uuid}").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/audio/{audio_uuid}").status_code == status.HTTP_200_OK


def test_somebody_who_could_only_read_it_cannot_destroy_it(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """403 and not 404 here, which is the ACL's own rule rather than an exception to it: below
    read the answer hides the recording, and above it a refusal is honest, because pretending
    something somebody is looking at does not exist would be a confusing lie."""
    audio_uuid = _a_recording(database, accounts, owner_library)
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "admin")
    client.delete(f"/audio/{audio_uuid}")
    client.delete("/auth/session")
    sign_in(client, "friend")
    assert client.delete(f"/trash/audio/{audio_uuid}").status_code == status.HTTP_403_FORBIDDEN


def test_destroying_a_library_takes_its_recordings_and_their_files(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """Trashed separately or not. Waiting out the retention destroys the same set, so Delete now
    that left rows behind would not be the thing it says it is."""
    trashed = _a_recording(database, accounts, owner_library, title="Trashed")
    untrashed = _a_recording(database, accounts, owner_library, title="Untrashed")
    for audio_uuid in (trashed, untrashed):
        _with_bytes(settings, audio_uuid)
    sign_in(client, "admin")
    client.delete(f"/audio/{trashed}")
    client.delete(f"/libraries/{owner_library}")
    assert (
        client.delete(f"/trash/libraries/{owner_library}").status_code == status.HTTP_204_NO_CONTENT
    )
    assert client.get("/trash/libraries").json()["total"] == 0
    assert client.get(f"/libraries/{owner_library}").status_code == status.HTTP_404_NOT_FOUND
    for audio_uuid in (trashed, untrashed):
        assert client.get(f"/audio/{audio_uuid}").status_code == status.HTTP_404_NOT_FOUND
        assert not storage.recording_dir(settings.resolved_storage_dir, audio_uuid).exists()


def test_a_library_that_is_not_in_the_trash_cannot_be_destroyed(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    assert (
        client.delete(f"/trash/libraries/{owner_library}").status_code == status.HTTP_404_NOT_FOUND
    )
    assert client.get(f"/libraries/{owner_library}").status_code == status.HTTP_200_OK


def test_a_destroyed_recording_leaves_the_search_index(
    client: TestClient,
    database: Database,
    settings: Settings,
    accounts: dict[str, int],
    owner_library: str,
) -> None:
    """The row and the index go together, or the archive keeps finding a recording nobody can
    open."""
    audio_uuid = _a_recording(database, accounts, owner_library, title="Grandmother")
    _with_bytes(settings, audio_uuid)
    sign_in(client, "admin")
    client.delete(f"/audio/{audio_uuid}")
    client.delete(f"/trash/audio/{audio_uuid}")
    assert client.get("/search", params={"q": "Grandmother"}).json()["total"] == 0
