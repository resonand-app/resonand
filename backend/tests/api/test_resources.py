"""Libraries, categories, recordings and administration over HTTP (``API-8``, ``API-9``).

These are about the endpoints, not the permissions -- the permission matrix is in
``tests/acl``. What is checked here is that the endpoints go through it: that a refusal comes out
as 404 or 403 in the right one of the two cases, and that nothing invents its own answer.
"""

from __future__ import annotations

from fastapi import status
from fastapi.testclient import TestClient
from sonarium.core.levels import Level
from sonarium.db import libraries as library_repo
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database

from tests.api.conftest import PASSWORD, ClientFactory, acl_resolutions, sign_in


def _recording(database: Database, library_uuid: str, owner_id: int, title: str = "A note") -> str:
    with database.write_session() as session:
        library = next(
            row[0]
            for row in library_repo.list_libraries(session, owner_id)
            if row[0].uuid == library_uuid
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner_id,
            storage_path=f"storage/aa/{title}/original.m4a",
            original_filename=f"{title}.m4a",
        )
        return audio.uuid


# --- Libraries ------------------------------------------------------------


def test_a_new_account_already_has_its_personal_library(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    listed = client.get("/libraries").json()
    assert [row["is_personal"] for row in listed] == [True]


def test_a_library_reports_the_level_the_caller_holds(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Resolved by the ACL rather than guessed by the client, which is why it is in the payload."""
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "friend")
    shared = next(row for row in client.get("/libraries").json() if row["uuid"] == owner_library)
    assert shared["level"] == int(Level.READ)


def test_somebody_elses_library_does_not_exist(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    """DEC-14: a 403 here would confirm the library exists."""
    sign_in(client, "stranger")
    assert client.get(f"/libraries/{owner_library}").status_code == status.HTTP_404_NOT_FOUND


def test_a_reader_is_told_they_cannot_rename_rather_than_that_it_is_missing(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.READ,
        )
    sign_in(client, "friend")
    refused = client.patch(f"/libraries/{owner_library}", json={"name": "Mine now"})
    assert refused.status_code == status.HTTP_403_FORBIDDEN
    assert "not change it" in refused.json()["detail"]


def test_creating_and_renaming_a_library(client: TestClient, accounts: dict[str, int]) -> None:
    sign_in(client, "admin")
    made = client.post("/libraries", json={"name": "Interviews"}).json()
    assert made["level"] == int(Level.OWNER)
    renamed = client.patch(f"/libraries/{made['uuid']}", json={"name": "Field interviews"})
    assert renamed.json()["name"] == "Field interviews"


def test_a_library_colour_is_chosen_and_can_be_changed(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """``DEC-8``: the design system identifies a library by a colour the user picked.

    Unchosen is a neutral default rather than a derived hue, and it is changeable — deriving it
    from the ``uuid`` would have made both of those false.
    """
    sign_in(client, "admin")
    made = client.post("/libraries", json={"name": "Interviews"}).json()
    assert made["colour"] == "stone"
    chosen = client.post("/libraries", json={"name": "Fieldwork", "colour": "moss"}).json()
    assert chosen["colour"] == "moss"
    recoloured = client.patch(f"/libraries/{chosen['uuid']}", json={"colour": "plum"})
    assert recoloured.json()["colour"] == "plum"
    refused = client.post("/libraries", json={"name": "Nope", "colour": "#E8B45C"})
    assert refused.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_a_personal_library_cannot_be_deleted_over_http(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "friend")
    personal = client.get("/libraries").json()[0]["uuid"]
    refused = client.delete(f"/libraries/{personal}")
    assert refused.status_code == status.HTTP_400_BAD_REQUEST


def test_sharing_requires_manage_and_the_level_is_explained_in_words(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    """UI-17 shows the explanation; it comes from the model so the two cannot drift."""
    sign_in(client, "admin")
    granted = client.put(
        f"/libraries/{owner_library}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.EDIT)},
    ).json()
    assert granted["level_description"].startswith("Can edit")


def test_an_editor_cannot_share_onwards(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    with database.write_session() as session:
        library_repo.share_library(
            session,
            accounts["admin"],
            owner_library,
            grantee_id=accounts["friend"],
            level=Level.EDIT,
        )
    sign_in(client, "friend")
    refused = client.put(
        f"/libraries/{owner_library}/shares",
        json={"grantee_id": accounts["stranger"], "level": int(Level.READ)},
    )
    assert refused.status_code == status.HTTP_403_FORBIDDEN


# --- Categories -----------------------------------------------------------


def test_the_category_tree_round_trips(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    unit = client.post(
        f"/libraries/{owner_library}/categories", json={"name": "The village"}
    ).json()
    child = client.post(
        f"/libraries/{owner_library}/categories",
        json={"name": "The factory", "parent_id": unit["id"]},
    ).json()
    tree = client.get(f"/libraries/{owner_library}/categories").json()
    assert {node["name"] for node in tree} == {"The village", "The factory"}
    assert child["parent_id"] == unit["id"]


def test_a_duplicate_sibling_name_is_a_conflict_with_a_readable_message(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    client.post(f"/libraries/{owner_library}/categories", json={"name": "Unit 1"})
    clash = client.post(f"/libraries/{owner_library}/categories", json={"name": "Unit 1"})
    assert clash.status_code == status.HTTP_409_CONFLICT
    assert "already a category" in clash.json()["detail"]


def test_a_category_cannot_be_moved_into_its_own_subtree_over_http(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    sign_in(client, "admin")
    parent = client.post(f"/libraries/{owner_library}/categories", json={"name": "Unit 1"}).json()
    child = client.post(
        f"/libraries/{owner_library}/categories",
        json={"name": "Lecture", "parent_id": parent["id"]},
    ).json()
    refused = client.patch(
        f"/libraries/{owner_library}/categories/{parent['id']}",
        json={"parent_id": child["id"]},
    )
    assert refused.status_code == status.HTTP_409_CONFLICT


def test_renaming_a_category_over_http_keeps_siblings_unique(
    client: TestClient, accounts: dict[str, int], owner_library: str
) -> None:
    """The same rule the repository enforces, through the verb the interface actually calls."""
    sign_in(client, "admin")
    first = client.post(f"/libraries/{owner_library}/categories", json={"name": "Unit 1"}).json()
    second = client.post(f"/libraries/{owner_library}/categories", json={"name": "Unit 2"}).json()

    renamed = client.patch(
        f"/libraries/{owner_library}/categories/{first['id']}", json={"name": "Week 1"}
    )
    assert renamed.status_code == status.HTTP_200_OK
    assert renamed.json()["name"] == "Week 1"

    clash = client.patch(
        f"/libraries/{owner_library}/categories/{second['id']}", json={"name": "Week 1"}
    )
    assert clash.status_code == status.HTTP_409_CONFLICT
    assert "already a category" in clash.json()["detail"]


# --- Recordings -----------------------------------------------------------


def test_a_recording_carries_its_four_state_transcription_status(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The card distinguishes four states, and they are derived in one place (``UI-6``)."""
    _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    listed = client.get("/audio").json()
    assert listed["items"][0]["transcription_state"] == "none"


def test_a_recording_keeps_its_own_reading_of_the_clock(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """DEC-11 end to end: what goes in as a wall clock comes back as one, with its offset apart."""
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    updated = client.patch(
        f"/audio/{uuid}",
        json={"recorded_at": "2024-03-11T18:22:00", "recorded_at_offset": 60},
    ).json()
    assert updated["recorded_at"] == "2024-03-11T18:22:00"
    assert updated["recorded_at_offset"] == 60


def test_an_instant_is_refused_as_a_recording_date(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    refused = client.patch(f"/audio/{uuid}", json={"recorded_at": "2024-03-11T17:22:04.000Z"})
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert "local reading" in refused.json()["detail"]


def test_tags_can_be_set_and_come_back_with_the_recording(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    updated = client.patch(f"/audio/{uuid}", json={"tags": ["family", "oral history"]}).json()
    assert {tag["slug"] for tag in updated["tags"]} == {"family", "oral-history"}


def test_tag_suggestions_come_only_from_your_own_recordings(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    client.patch(f"/audio/{uuid}", json={"tags": ["confidential source"]})
    client.delete("/auth/session")
    sign_in(client, "stranger")
    assert client.get("/tags", params={"prefix": "conf"}).json() == []


def test_a_recording_goes_to_the_trash_and_comes_back(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    assert client.delete(f"/audio/{uuid}").status_code == status.HTTP_204_NO_CONTENT
    assert client.get(f"/audio/{uuid}").status_code == status.HTTP_404_NOT_FOUND
    assert client.get("/trash/audio").json()["total"] == 1
    assert client.post(f"/audio/{uuid}/restore").status_code == status.HTTP_200_OK
    assert client.get(f"/audio/{uuid}").status_code == status.HTTP_200_OK


def test_moving_a_recording_reports_the_library_it_landed_in(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    destination = client.post("/libraries", json={"name": "Elsewhere"}).json()["uuid"]
    moved = client.post(f"/audio/{uuid}/move", json={"library_uuid": destination}).json()
    assert moved["library_uuid"] == destination
    assert moved["category_id"] is None


def test_a_write_resolves_the_permission_once(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``REV-7``: each of these used to ask twice, once to write and once for the presenter.

    Two extra resolutions per write, held inside the write lock, for an answer the service
    function already had in its hand.
    """
    uuid = _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")

    with acl_resolutions(database) as renaming:
        assert client.patch(f"/audio/{uuid}", json={"title": "Renamed"}).status_code == 200

    client.delete(f"/audio/{uuid}")
    with acl_resolutions(database) as restoring:
        assert client.post(f"/audio/{uuid}/restore").status_code == 200

    with acl_resolutions(database) as recolouring:
        patched = client.patch(f"/libraries/{owner_library}", json={"name": "Family archive"})
        assert patched.status_code == 200

    counted = (len(renaming), len(restoring), len(recolouring))
    assert counted == (1, 1, 1), f"resolutions per write: {counted}"


def test_moving_a_recording_reports_the_level_it_carries_afterwards(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """A move is the one write that changes the answer, so it is the one that asks twice.

    Permissions come from the library a recording is in. Somebody who owns a recording and moves
    it into a library they merely edit may edit it afterwards and no more, and the response has
    to say so rather than repeat the level they held on the way in (``REV-7``).
    """
    uuid = _recording(database, owner_library, accounts["admin"])
    with database.write_session() as session:
        theirs = library_repo.create_library(session, accounts["friend"], name="Theirs")
        library_repo.share_library(
            session,
            accounts["friend"],
            theirs.uuid,
            grantee_id=accounts["admin"],
            level=Level.EDIT,
        )
        destination = theirs.uuid

    sign_in(client, "admin")
    moved = client.post(f"/audio/{uuid}/move", json={"library_uuid": destination}).json()
    assert moved["library_uuid"] == destination
    assert moved["level"] == Level.EDIT, "not the ownership they held in the library it left"


def test_a_page_carries_the_total(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    for index in range(5):
        _recording(database, owner_library, accounts["admin"], title=f"note {index}")
    sign_in(client, "admin")
    page = client.get("/audio", params={"limit": 2}).json()
    assert page["total"] == 5
    assert len(page["items"]) == 2


# --- Administration -------------------------------------------------------


def test_administration_is_refused_to_everybody_else(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """A 403 rather than a 404: the caller is signed in and knows an administration area exists."""
    sign_in(client, "friend")
    assert client.get("/admin/users").status_code == status.HTTP_403_FORBIDDEN


def test_an_administrator_creates_the_other_accounts_by_hand(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    made = client.post(
        "/admin/users",
        json={
            "email": "newcomer@example.test",
            "display_name": "Newcomer",
            "password": PASSWORD,
        },
    )
    assert made.status_code == status.HTTP_201_CREATED


def test_deleting_a_user_with_content_is_refused_with_the_numbers(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """The message says why and what to do instead, rather than apologising."""
    _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    refused = client.delete(f"/admin/users/{accounts['admin']}")
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    detail = refused.json()["detail"]
    assert "1 library" in detail
    assert "1 recording" in detail
    assert "Disable the account instead" in detail


def test_an_empty_account_can_be_deleted(client: TestClient, accounts: dict[str, int]) -> None:
    sign_in(client, "admin")
    assert client.delete(f"/admin/users/{accounts['stranger']}").status_code == 204


def test_disabling_an_account_stops_it_on_its_next_request(
    client: TestClient, accounts: dict[str, int], app_client_factory: ClientFactory
) -> None:
    """Enforced in the ACL, so it takes effect immediately rather than at the next sign-in."""
    theirs = app_client_factory()
    sign_in(theirs, "friend")
    assert theirs.get("/libraries").status_code == status.HTTP_200_OK
    sign_in(client, "admin")
    client.post(f"/admin/users/{accounts['friend']}/disable")
    assert theirs.get("/libraries").status_code == status.HTTP_401_UNAUTHORIZED


def test_an_administrator_cannot_disable_themselves(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    refused = client.post(f"/admin/users/{accounts['admin']}/disable")
    assert refused.status_code == status.HTTP_409_CONFLICT


def test_the_list_says_which_accounts_are_disabled_and_which_run_the_instance(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """``INT-3b`` chooses between disable and re-enable, which it cannot do without knowing which
    one an account is already in -- and it marks administrators."""
    sign_in(client, "admin")
    client.post(f"/admin/users/{accounts['friend']}/disable")
    listed = {row["id"]: row for row in client.get("/admin/users").json()}
    assert listed[accounts["admin"]]["is_admin"] is True
    assert listed[accounts["admin"]]["disabled_at"] is None
    assert listed[accounts["friend"]]["is_admin"] is False
    assert listed[accounts["friend"]]["disabled_at"] is not None


def test_disable_and_enable_answer_with_the_account_they_changed(
    client: TestClient, accounts: dict[str, int]
) -> None:
    """So the row redraws from the answer rather than from a second request that might race it."""
    sign_in(client, "admin")
    disabled = client.post(f"/admin/users/{accounts['friend']}/disable").json()
    assert disabled["disabled_at"] is not None
    enabled = client.post(f"/admin/users/{accounts['friend']}/enable").json()
    assert enabled["disabled_at"] is None


def test_a_share_still_says_nothing_about_who_runs_the_instance(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """Which is why administration got a shape of its own rather than a wider ``UserSummary``.

    A share and ``API-15``'s lookup both answer with that one, so ``is_admin`` on it would tell
    any library manager who runs the instance -- the leak the narrow lookup exists to prevent.
    """
    sign_in(client, "admin")
    client.put(
        f"/libraries/{owner_library}/shares",
        json={"grantee_id": accounts["friend"], "level": int(Level.READ)},
    )
    grantee = client.get(f"/libraries/{owner_library}/shares").json()[0]["grantee"]
    assert set(grantee) == {"id", "display_name", "email"}
    found = client.get("/users/lookup", params={"email": "friend@example.test"}).json()
    assert set(found[0]) == {"id", "display_name", "email"}


# --- Operations -----------------------------------------------------------


def test_liveness_and_readiness_answer_without_a_session(origin_client: TestClient) -> None:
    """At the origin, not under ``/api``: the probes did not move with the API (``API-16``)."""
    assert origin_client.get("/healthz").json()["status"] == "ok"
    assert origin_client.get("/readyz").json()["status"] == "ready"


# --- Search ---------------------------------------------------------------


def test_search_finds_a_recording_by_its_title(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    _recording(database, owner_library, accounts["admin"], title="Grandmother")
    sign_in(client, "admin")
    found = client.get("/search", params={"q": "grandmother"}).json()
    assert found["total"] == 1
    assert found["items"][0]["audio"]["title"] == "Grandmother"


def test_search_finds_nothing_for_somebody_who_can_see_nothing(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    _recording(database, owner_library, accounts["admin"], title="Grandmother")
    sign_in(client, "stranger")
    assert client.get("/search", params={"q": "grandmother"}).json()["total"] == 0


def test_search_says_what_it_cannot_do(client: TestClient, accounts: dict[str, int]) -> None:
    """JOB-14's limitation comes from the backend, so the interface cannot describe the old
    behaviour after the index changes."""
    sign_in(client, "admin")
    assert "other forms" in client.get("/search/about").json()["recall"]


def test_the_state_filter_is_repeatable_and_means_either(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``JOB-11b``: four independent toggles, so two ticked is a union.

    It used to be a single value, which meant a second toggle silently replaced the first --
    the interface would have shown two ticked and filtered by one.
    """
    _recording(database, owner_library, accounts["admin"], title="Grandmother")
    sign_in(client, "admin")
    untranscribed = client.get(
        "/search", params={"q": "grandmother", "transcription_state": "none"}
    ).json()
    assert untranscribed["total"] == 1

    either = client.get(
        "/search",
        params=[
            ("q", "grandmother"),
            ("transcription_state", "none"),
            ("transcription_state", "done"),
        ],
    ).json()
    assert either["total"] == 1, "the union still contains it, rather than only the last value"

    elsewhere = client.get(
        "/search", params={"q": "grandmother", "transcription_state": "done"}
    ).json()
    assert elsewhere["total"] == 0


def test_all_four_states_are_answerable(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    """``running`` and ``failed`` used to be rejected, which is why two of the interface's four
    toggles were drawn visibly disabled."""
    _recording(database, owner_library, accounts["admin"], title="Grandmother")
    sign_in(client, "admin")
    for state in ("none", "running", "done", "failed"):
        answered = client.get("/search", params={"q": "grandmother", "transcription_state": state})
        assert answered.status_code == status.HTTP_200_OK, state


def test_something_that_is_not_a_state_is_refused(
    client: TestClient, accounts: dict[str, int]
) -> None:
    sign_in(client, "admin")
    refused = client.get("/search", params={"q": "x", "transcription_state": "halfway"})
    assert refused.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_an_empty_search_is_an_empty_page_not_the_whole_archive(
    client: TestClient, database: Database, accounts: dict[str, int], owner_library: str
) -> None:
    _recording(database, owner_library, accounts["admin"])
    sign_in(client, "admin")
    assert client.get("/search", params={"q": ""}).json()["total"] == 0
