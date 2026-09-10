"""The repositories (``DAT-4`` to ``DAT-8``).

Each of these defends a rule that lives in exactly one place because the ACL made it possible to
put it there: nothing below re-checks a permission, and nothing above is allowed to skip one.
"""

from __future__ import annotations

import pytest
from sonarium.core.errors import (
    ConflictError,
    InvalidRequestError,
    PermissionDeniedError,
)
from sonarium.core.levels import Level
from sonarium.db import categories, libraries, seed, tags, transcripts, users
from sonarium.db.audio import (
    MetadataPatch,
    create_audio,
    find_duplicates,
    move_audio,
    restore_audio,
    trash_audio,
    trashed_audio,
    update_metadata,
)
from sonarium.db.engine import Database
from sonarium.db.models import Audio, Library, Segment
from sonarium.db.transcripts import Origin, SegmentDraft
from sqlalchemy import event, select, text

# --- Accounts and the personal library (DAT-5) ----------------------------


def test_creating_a_user_creates_their_personal_library(database: Database) -> None:
    """audio.library_id is NOT NULL only because this always happens."""
    with database.write_session() as session:
        user = users.create_user(session, email="a@x.test", display_name="A")
        personal = users.personal_library(session, user.id)
    assert personal.is_personal == 1
    assert personal.owner_id == user.id


def test_a_failed_user_creation_leaves_no_half_account(database: Database) -> None:
    """The two writes are one transaction, so there is no path to a user without a library."""
    with pytest.raises(ConflictError), database.write_session() as session:
        users.create_user(session, email="a@x.test", display_name="A")
        users.create_user(session, email="a@x.test", display_name="Again")
    with database.read_session() as session:
        assert session.execute(select(Audio)).all() == []
        assert users.count_users(session) == 0


def test_counting_accounts_asks_the_database_for_the_number(database: Database) -> None:
    """``REV-2``: one integer was being measured by fetching every id and taking its length.

    Asserted on the statement rather than on the result, because both versions answer 3 -- what
    differs is whether the work grows with the archive.
    """
    with database.write_session() as session:
        for index in range(3):
            users.create_user(session, email=f"a{index}@x.test", display_name=f"A{index}")
    statements: list[str] = []

    def record(
        _connection: object,
        _cursor: object,
        statement: str,
        _parameters: object,
        _context: object,
        _executemany: bool,
    ) -> None:
        statements.append(statement)

    event.listen(database.engine, "before_cursor_execute", record)
    try:
        with database.read_session() as session:
            assert users.count_users(session) == 3
    finally:
        event.remove(database.engine, "before_cursor_execute", record)
    counted = [line for line in statements if "user" in line.lower()]
    assert counted and all("count(" in line.lower() for line in counted)


def test_an_address_is_taken_whichever_way_it_is_typed(database: Database) -> None:
    with database.write_session() as session:
        users.create_user(session, email="Gabriel@x.test", display_name="G")
    with pytest.raises(ConflictError), database.write_session() as session:
        users.create_user(session, email="gabriel@x.test", display_name="G again")


def test_the_typed_form_is_kept_for_display(database: Database) -> None:
    with database.write_session() as session:
        user = users.create_user(session, email="Gabriel@X.test", display_name="G")
    assert user.email == "Gabriel@X.test"
    assert user.email_normalised == "gabriel@x.test"


def test_a_personal_library_cannot_be_deleted(database: Database) -> None:
    with database.write_session() as session:
        user = users.create_user(session, email="a@x.test", display_name="A")
        personal = users.personal_library(session, user.id)
        with pytest.raises(InvalidRequestError, match="personal library"):
            libraries.trash_library(session, user.id, personal.uuid)


# --- Sharing (API-8) ------------------------------------------------------


def test_only_a_manager_can_share_onwards(database: Database) -> None:
    """The one thing an editor cannot do, which is the whole difference between the levels."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        editor = users.create_user(session, email="e@x.test", display_name="E")
        outsider = users.create_user(session, email="s@x.test", display_name="S")
        library = libraries.create_library(session, owner.id, name="Shared")
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=editor.id, level=Level.EDIT
        )
        with pytest.raises(PermissionDeniedError):
            libraries.share_library(
                session, editor.id, library.uuid, grantee_id=outsider.id, level=Level.READ
            )


def test_sharing_twice_raises_the_level_rather_than_duplicating(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        friend = users.create_user(session, email="f@x.test", display_name="F")
        library = libraries.create_library(session, owner.id, name="Shared")
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=friend.id, level=Level.READ
        )
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=friend.id, level=Level.MANAGE
        )
        granted = libraries.list_shares(session, owner.id, library.uuid)
    assert len(granted) == 1
    assert granted[0][0].level == int(Level.MANAGE)


def test_ownership_cannot_be_granted_as_a_share(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        friend = users.create_user(session, email="f@x.test", display_name="F")
        library = libraries.create_library(session, owner.id, name="Shared")
        with pytest.raises(InvalidRequestError):
            libraries.share_library(
                session, owner.id, library.uuid, grantee_id=friend.id, level=Level.OWNER
            )


def test_revoking_takes_the_library_away(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        friend = users.create_user(session, email="f@x.test", display_name="F")
        library = libraries.create_library(session, owner.id, name="Shared")
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=friend.id, level=Level.READ
        )
        assert libraries.list_libraries(session, friend.id)
        libraries.unshare_library(session, owner.id, library.uuid, grantee_id=friend.id)
        remaining = [row[0].uuid for row in libraries.list_libraries(session, friend.id)]
    assert library.uuid not in remaining


# --- The category tree (DAT-7) --------------------------------------------


def test_two_siblings_cannot_share_a_name(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Course")
        categories.create_category(session, owner.id, library.uuid, name="Unit 1")
        with pytest.raises(ConflictError, match="already a category"):
            categories.create_category(session, owner.id, library.uuid, name="Unit 1")


def test_a_category_cannot_be_moved_inside_its_own_subtree(database: Database) -> None:
    """The whole branch would vanish from the tree while still being in the table."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Course")
        parent = categories.create_category(session, owner.id, library.uuid, name="Unit 1")
        child = categories.create_category(
            session, owner.id, library.uuid, name="Lecture", parent_id=parent.id
        )
        grandchild = categories.create_category(
            session, owner.id, library.uuid, name="Notes", parent_id=child.id
        )
        with pytest.raises(ConflictError, match="subcategories"):
            categories.move_category(session, owner.id, parent.id, parent_id=grandchild.id)


def test_a_category_cannot_be_its_own_parent(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Course")
        node = categories.create_category(session, owner.id, library.uuid, name="Unit 1")
        with pytest.raises(ConflictError, match="inside itself"):
            categories.move_category(session, owner.id, node.id, parent_id=node.id)


def test_a_parent_from_another_library_is_refused(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        here = libraries.create_library(session, owner.id, name="Here")
        there = libraries.create_library(session, owner.id, name="There")
        foreign = categories.create_category(session, owner.id, there.uuid, name="Elsewhere")
        with pytest.raises(InvalidRequestError, match="not in this library"):
            categories.create_category(
                session, owner.id, here.uuid, name="Child", parent_id=foreign.id
            )


def test_reordering_sets_the_order_given(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Course")
        first = categories.create_category(session, owner.id, library.uuid, name="A")
        second = categories.create_category(session, owner.id, library.uuid, name="B")
        third = categories.create_category(session, owner.id, library.uuid, name="C")
        categories.reorder_categories(session, owner.id, [third.id, first.id, second.id])
        tree = categories.list_categories(session, owner.id, library.uuid)
    assert [node.name for node in tree] == ["C", "A", "B"]


def test_deleting_a_category_uncategorises_its_recordings_rather_than_failing(
    database: Database,
) -> None:
    """ON DELETE SET NULL would try to null library_id too, which is NOT NULL."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Course")
        unit = categories.create_category(session, owner.id, library.uuid, name="Unit 1")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="lecture.m4a",
        )
        audio.category_id = unit.id
        session.flush()
        categories.delete_category(session, owner.id, unit.id)
        session.refresh(audio)
    assert audio.category_id is None


def test_a_reader_cannot_change_the_tree(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        reader = users.create_user(session, email="r@x.test", display_name="R")
        library = libraries.create_library(session, owner.id, name="Course")
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=reader.id, level=Level.READ
        )
        with pytest.raises(PermissionDeniedError):
            categories.create_category(session, reader.id, library.uuid, name="Unit 1")


# --- Tags (DAT-6) ---------------------------------------------------------


def test_the_first_writer_owns_the_display_name(database: Database) -> None:
    with database.write_session() as session:
        first = tags.resolve_tag(session, "Física")
        second = tags.resolve_tag(session, "fisica")
    assert second.id == first.id
    assert second.name == "Física", "the second writer must not rename it for everybody"


def test_setting_tags_replaces_rather_than_accumulates(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        tags.set_audio_tags(session, audio.id, ["family", "village"])
        tags.set_audio_tags(session, audio.id, ["village", "factory"])
        current = [tag.slug for tag in tags.tags_for_audio(session, audio.id)]
    assert sorted(current) == ["factory", "village"]


def test_autocomplete_does_not_leak_other_peoples_tags(database: Database) -> None:
    """A global vocabulary with an unfiltered suggestion list is a directory of what everybody
    else on the instance records."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        stranger = users.create_user(session, email="s@x.test", display_name="S")
        library = libraries.create_library(session, owner.id, name="Private")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        tags.set_audio_tags(session, audio.id, ["confidential source"])
        theirs = tags.suggest_tags(session, owner.id, "conf")
        strangers = tags.suggest_tags(session, stranger.id, "conf")
    assert [tag.slug for tag, _ in theirs] == ["confidential-source"]
    assert strangers == []


def test_an_unusable_tag_name_is_refused(database: Database) -> None:
    with database.write_session() as session, pytest.raises(InvalidRequestError):
        tags.resolve_tag(session, "   ")


# --- Recording metadata, trash and moving (API-9, ING-10) -----------------


def test_a_recording_date_must_be_a_wall_clock_reading(database: Database) -> None:
    """Storing an instant here is silently wrong until somebody abroad sees the wrong hour."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        with pytest.raises(InvalidRequestError, match="local reading"):
            update_metadata(
                session,
                owner.id,
                audio.uuid,
                MetadataPatch(recorded_at="2024-03-11T18:22:04.000Z"),
            )


def test_a_reader_cannot_edit_metadata_but_is_told_why(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        reader = users.create_user(session, email="r@x.test", display_name="R")
        library = libraries.create_library(session, owner.id, name="L")
        libraries.share_library(
            session, owner.id, library.uuid, grantee_id=reader.id, level=Level.READ
        )
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        with pytest.raises(PermissionDeniedError, match="not change it"):
            update_metadata(session, reader.id, audio.uuid, MetadataPatch(title="Mine now"))


def test_moving_a_recording_clears_its_category_and_keeps_its_grants(
    database: Database,
) -> None:
    """All three consequences of a move, in one place, because UI-19 has to state all three."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        friend = users.create_user(session, email="f@x.test", display_name="F")
        source = libraries.create_library(session, owner.id, name="Source")
        destination = libraries.create_library(session, owner.id, name="Destination")
        unit = categories.create_category(session, owner.id, source.uuid, name="Unit 1")
        audio = create_audio(
            session,
            library_id=source.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        audio.category_id = unit.id
        session.flush()
        session.execute(
            text(
                "INSERT INTO share (audio_id, grantee_id, level, granted_by, created_at) "
                "VALUES (:audio, :grantee, 10, :granter, '')"
            ),
            {"audio": audio.id, "grantee": friend.id, "granter": owner.id},
        )
        move_audio(session, owner.id, audio.uuid, destination.uuid)
        moved = session.execute(
            text("SELECT library_id, category_id FROM audio WHERE id = :id"), {"id": audio.id}
        ).one()
        surviving = session.execute(
            text("SELECT count(*) FROM share WHERE audio_id = :id"), {"id": audio.id}
        ).scalar_one()
        destination_id = destination.id
    assert moved.library_id == destination_id
    assert moved.category_id is None
    assert surviving == 1, "grants point at the recording, not at where it happens to live"


def test_trashing_takes_a_recording_out_of_search_and_restoring_puts_it_back(
    database: Database,
) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="Grandmother.m4a",
        )
        trash_audio(session, owner.id, audio.uuid)
        gone = session.execute(
            text("SELECT count(*) FROM audio_fts WHERE audio_fts MATCH 'grandmother'")
        ).scalar_one()
        restore_audio(session, owner.id, audio.uuid)
        back = session.execute(
            text("SELECT count(*) FROM audio_fts WHERE audio_fts MATCH 'grandmother'")
        ).scalar_one()
    assert gone == 0
    assert back == 1


def test_the_trash_lists_what_is_about_to_go_first(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        for name in ("first", "second"):
            audio = create_audio(
                session,
                library_id=library.id,
                uploaded_by=owner.id,
                storage_path=f"storage/aa/{name}/original.m4a",
                original_filename=f"{name}.m4a",
            )
            trash_audio(session, owner.id, audio.uuid)
        listed = [row[0].title for row in session.execute(trashed_audio(owner.id)).all()]
    assert listed == ["first", "second"]


def test_a_duplicate_in_the_trash_is_reported_as_such(database: Database) -> None:
    """Excluding the trash would let a restore produce a real duplicate (DEC-16)."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
            sha256="e" * 64,
        )
        trash_audio(session, owner.id, audio.uuid)
        found = find_duplicates(session, owner.id, "e" * 64)
    assert len(found) == 1
    assert found[0][1] is True, "the interface offers to restore rather than to upload again"


def test_a_default_title_comes_from_the_filename(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="Recording 2024-03-11 18.22.m4a",
        )
    assert audio.title == "Recording 2024-03-11 18.22"


# --- Transcripts (JOB-6, JOB-7) -------------------------------------------


def test_re_transcribing_keeps_the_old_one_and_switches_which_is_active(
    database: Database,
) -> None:
    """Engine independence is only real if changing engine loses nothing."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        first = transcripts.create_transcript(
            session, audio.id, [SegmentDraft(0, 1000, "first pass")], Origin(model="tiny")
        )
        second = transcripts.create_transcript(
            session, audio.id, [SegmentDraft(0, 1000, "better pass")], Origin(model="large")
        )
        active = transcripts.active_transcript(session, audio.id)
        every = transcripts.list_transcripts(session, audio.id)
    assert active is not None
    assert active.id == second.id
    assert {row.id for row in every} == {first.id, second.id}


def test_switching_back_is_atomic(database: Database) -> None:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        first = transcripts.create_transcript(session, audio.id, [SegmentDraft(0, 1, "a")])
        transcripts.create_transcript(session, audio.id, [SegmentDraft(0, 1, "b")])
        transcripts.activate(session, first.id)
        active = transcripts.active_transcript(session, audio.id)
    assert active is not None
    assert active.id == first.id


def test_segments_are_renumbered_in_the_order_given(database: Database) -> None:
    """A provider that returned its parts out of order must not scramble the transcript."""
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        transcript = transcripts.create_transcript(
            session,
            audio.id,
            [SegmentDraft(0, 1000, "one"), SegmentDraft(1000, 2000, "two")],
        )
        rows = transcripts.segments_of(session, transcript.id)
    assert [row.idx for row in rows] == [0, 1]
    assert transcripts.plain_text(rows) == "one two"


def test_an_impossibly_timed_segment_is_refused() -> None:
    with pytest.raises(InvalidRequestError, match="timed impossibly"):
        transcripts.validate_segments([SegmentDraft(5000, 1000, "backwards")])


def test_creating_a_transcript_refuses_impossible_timings_before_writing_anything(
    database: Database,
) -> None:
    """``REV-6``: the check existed and nothing on the ingestion path called it.

    A transcript whose end precedes its start reads correctly and seeks to the wrong place, which
    is why it has to fail here rather than reach a row.
    """
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="storage/aa/aa/original.m4a",
            original_filename="a.m4a",
        )
        audio_id = audio.id
    with (
        pytest.raises(InvalidRequestError, match="timed impossibly"),
        database.write_session() as session,
    ):
        transcripts.create_transcript(
            session, audio_id, [SegmentDraft(0, 1000, "fine"), SegmentDraft(5000, 1000, "not")]
        )
    with database.read_session() as session:
        assert transcripts.list_transcripts(session, audio_id) == []
        assert session.execute(select(Segment)).scalars().all() == []


# --- The seed (DAT-8) -----------------------------------------------------


def test_the_seed_produces_every_shape_the_interface_has_to_handle(database: Database) -> None:
    with database.write_session() as session:
        made = seed.seed(session)
        readable = libraries.list_libraries(session, made.reader.id)
        owned = libraries.list_libraries(session, made.owner.id)
        trashed = session.execute(trashed_audio(made.owner.id)).all()
        with_transcript = transcripts.active_transcript(session, made.recordings[0].id)
    assert {level for _, level in readable} == {Level.READ, Level.OWNER}
    assert len(owned) == 2, "their own personal library and the shared one"
    assert len(trashed) == 1
    assert with_transcript is not None


def test_no_seeded_account_can_be_signed_into(database: Database) -> None:
    with database.write_session() as session:
        seed.seed(session)
        hashes = session.execute(select(text("password_hash")).select_from(text("user"))).scalars()
    assert all(value == seed.UNUSABLE_CREDENTIAL for value in hashes)


def test_the_seed_is_the_same_every_time(database: Database) -> None:
    """A seed that shuffles produces screenshots that cannot be compared."""
    with database.write_session() as session:
        first = [row.title for row in session.execute(select(Audio)).scalars()]
        seed.seed(session)
        titles = [row.title for row in session.execute(select(Audio).order_by(Audio.id)).scalars()]
    assert first == []
    assert titles == [
        "Recording 2024-03-11 18.22",
        "PTT-20240412-WA0007",
        "Thinking out loud while driving",
        "Test recording, ignore",
    ]


def test_the_library_header_counts_only_what_the_grid_shows(database: Database) -> None:
    with database.write_session() as session:
        made = seed.seed(session)
        shared = session.execute(
            select(Library).where(Library.uuid == made.shared.uuid)
        ).scalar_one()
        count, duration = libraries.library_totals(session, shared.id)
    assert count == 2, "the trashed recording is not counted"
    assert duration == 2_400_000 + 63_000
