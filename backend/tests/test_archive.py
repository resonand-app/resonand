"""Export and re-import (``ING-11``, ``DEC-5``).

The test that matters here is the round trip. Exit criterion 4 for the first version is that
exporting the whole archive and importing it into an empty instance gives back the same thing --
and the failure mode it guards against is not losing recordings but **doubling** them, which is
what an export without stable identifiers does.
"""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path
from uuid import uuid4

import pytest
from resonand.archive import (
    SIDECAR_NAME,
    SIDECAR_VERSION,
    apply_manifest,
    apply_sidecar,
    export_recording,
    find_by_uuid,
    library_named_by,
    manifest_for,
    read_sidecar,
    sidecar_for,
)
from resonand.core.config import Settings
from resonand.core.levels import Level
from resonand.db import libraries, tags, transcripts, users
from resonand.db.audio import create_audio
from resonand.db.engine import Database, build_engine
from resonand.db.migrate import upgrade_to_head
from resonand.db.models import Audio, Category, Library, Share, User
from resonand.db.transcripts import Origin, SegmentDraft
from resonand.media import storage
from resonand.media.subtitles import Cue, to_srt, to_vtt
from sqlalchemy import select
from sqlalchemy.orm import Session


def store_recording(
    session: Session,
    db_settings: Settings,
    *,
    filename: str,
    library_id: int | None = None,
    owner_id: int | None = None,
    transcript: bool = True,
) -> Audio:
    """One recording with its bytes on disk, for a test that needs a second one."""
    if library_id is None or owner_id is None:
        owner = users.create_user(session, email=f"{uuid4().hex}@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")
        library_id, owner_id = library.id, owner.id
    audio = create_audio(
        session,
        library_id=library_id,
        uploaded_by=owner_id,
        storage_path="",
        original_filename=filename,
    )
    path, digest = storage.store_original(
        db_settings.resolved_storage_dir, audio.uuid, [b"the original bytes"], filename=filename
    )
    audio.storage_path = storage.relative(db_settings.resolved_storage_dir, path)
    audio.sha256 = digest.sha256
    audio.size_bytes = digest.size_bytes
    audio.recorded_at = "2024-03-11T18:22:00"
    audio.recorded_at_offset = 60
    audio.recorded_at_source = "container"
    audio.recorded_at_precision = "second"
    audio.duration_ms = 2_400_000
    tags.set_audio_tags(session, audio.id, ["family", "oral history"])
    if transcript:
        transcripts.create_transcript(
            session,
            audio.id,
            [
                SegmentDraft(0, 4_200, "She starts by talking about the village."),
                SegmentDraft(4_200, 9_100, "Then about the factory."),
            ],
            Origin(
                provider="openai-compatible",
                model="whisper-1",
                language="en",
                stitched_from=3,
            ),
        )
    session.flush()
    return audio


@pytest.fixture
def recording(database: Database, db_settings: Settings) -> str:
    with database.write_session() as session:
        audio = store_recording(session, db_settings, filename="Recording 2024-03-11 18.22.m4a")
        return audio.uuid


def test_a_sidecar_carries_everything_needed_to_rebuild_the_recording(
    database: Database, recording: str
) -> None:
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    assert payload["uuid"] == recording
    assert payload["title"] == "Recording 2024-03-11 18.22"
    assert sorted(payload["tags"]) == ["family", "oral history"]
    assert payload["transcript"]["segments"][1]["text"] == "Then about the factory."
    assert payload["resonand"]["sidecar_version"] == SIDECAR_VERSION


def test_a_recording_keeps_its_own_reading_of_the_clock_through_the_export(
    database: Database, recording: str
) -> None:
    """A round trip through the export must not quietly shift a recording into another timezone."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    assert payload["recorded_at"] == "2024-03-11T18:22:00"
    assert payload["recorded_at_offset_minutes"] == 60
    assert "Z" not in str(payload["recorded_at"])


def test_how_a_date_was_arrived_at_travels_with_it(database: Database, recording: str) -> None:
    """Neither is recoverable on the far side: the file re-ingests under its stored name, and a
    day with no hour is indistinguishable from a midnight once the two are apart."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    payload["recorded_at_source"] = "filename"
    payload["recorded_at_precision"] = "date"

    with database.write_session() as session:
        again = find_by_uuid(session, recording)
        assert again is not None
        apply_sidecar(session, again, payload)

    with database.read_session() as session:
        landed = find_by_uuid(session, recording)
        assert landed is not None
        assert landed.recorded_at_source == "filename"
        assert landed.recorded_at_precision == "date"


def test_an_export_writes_the_audio_the_sidecar_and_the_subtitles(
    database: Database, db_settings: Settings, recording: str, tmp_path: Path
) -> None:
    destination = tmp_path / "export"
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        written = export_recording(session, audio, destination, db_settings.resolved_storage_dir)
    assert written.audio.read_bytes() == b"the original bytes"
    assert {path.suffix for path in written.subtitles} == {".vtt", ".srt"}
    assert json.loads(written.sidecar.read_text())["uuid"] == recording


def test_the_original_is_copied_rather_than_read_into_memory(
    database: Database,
    db_settings: Settings,
    recording: str,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """``REV-9``: this command is principle 1's proof and it died on a large original.

    Asserted as "the file never becomes one object in memory" rather than by exporting something
    enormous: the size at which the old line failed is larger than a test has any business
    writing to disk.
    """
    destination = tmp_path / "export"

    def refuse(self: Path) -> bytes:
        raise AssertionError(f"{self} was read into memory whole.")

    monkeypatch.setattr(Path, "read_bytes", refuse)
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        written = export_recording(session, audio, destination, db_settings.resolved_storage_dir)
    monkeypatch.undo()
    assert written.audio.read_bytes() == b"the original bytes"


def test_the_export_is_readable_without_this_software(
    database: Database, db_settings: Settings, recording: str, tmp_path: Path
) -> None:
    """Principle 1: the format does not need Resonand to read it."""
    destination = tmp_path / "export"
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        written = export_recording(session, audio, destination, db_settings.resolved_storage_dir)
    vtt = next(path for path in written.subtitles if path.suffix == ".vtt").read_text()
    assert vtt.startswith("WEBVTT")
    assert "00:00:04.200 --> 00:00:09.100" in vtt


def test_re_importing_updates_rather_than_duplicating(
    database: Database, recording: str, tmp_path: Path
) -> None:
    """Without the uuid in the sidecar, the round trip in the exit criteria doubles the archive
    rather than verifying it."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)

    payload["title"] = "Grandmother, third afternoon"
    with database.write_session() as session:
        again = find_by_uuid(session, recording)
        assert again is not None, "the sidecar's uuid finds the recording that is already here"
        apply_sidecar(session, again, payload)

    with database.read_session() as session:
        every = session.query(Audio).all()
    assert len(every) == 1
    assert every[0].title == "Grandmother, third afternoon"


def test_what_a_transcript_is_survives_the_round_trip(
    database: Database, recording: str, tmp_path: Path
) -> None:
    """``TRX-12``: the part count cannot be recomputed on the far side, so it has to travel."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    assert payload["transcript"]["task"] == "transcribe"
    assert payload["transcript"]["stitched_from"] == 3

    with database.write_session() as session:
        again = find_by_uuid(session, recording)
        assert again is not None
        apply_sidecar(session, again, payload)

    with database.read_session() as session:
        restored = find_by_uuid(session, recording)
        assert restored is not None
        transcript = transcripts.active_transcript(session, restored.id)
        assert transcript is not None
        features = transcripts.features_of(session, transcript)
    assert features.task == "transcribe"
    assert features.stitched_from == 3


def test_a_sidecar_written_before_a_transcript_knew_what_it_was_still_imports(
    database: Database, recording: str
) -> None:
    """An older sidecar carries neither field, and the defaults are what it actually was."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    del payload["transcript"]["task"]
    del payload["transcript"]["stitched_from"]

    with database.write_session() as session:
        again = find_by_uuid(session, recording)
        assert again is not None
        apply_sidecar(session, again, payload)

    with database.read_session() as session:
        restored = find_by_uuid(session, recording)
        assert restored is not None
        transcript = transcripts.active_transcript(session, restored.id)
        assert transcript is not None
        features = transcripts.features_of(session, transcript)
    assert features.task == "transcribe"
    assert features.stitched_from is None


def test_a_sidecar_from_a_future_version_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "future.resonand.json"
    path.write_text(json.dumps({"resonand": {"sidecar_version": 99}, "uuid": "x"}))
    with pytest.raises(ValueError, match="sidecar version 99"):
        read_sidecar(path)


def test_something_that_is_not_a_sidecar_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "notes.json"
    path.write_text(json.dumps(["not", "a", "sidecar"]))
    with pytest.raises(ValueError, match="not a Resonand sidecar"):
        read_sidecar(path)


# --- The layout -----------------------------------------------------------


def test_each_recording_gets_a_directory_of_its_own(
    database: Database, db_settings: Settings, recording: str, tmp_path: Path
) -> None:
    destination = tmp_path / "export"
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        written = export_recording(session, audio, destination, db_settings.resolved_storage_dir)
    assert written.directory == destination / recording
    assert written.sidecar == written.directory / SIDECAR_NAME
    assert {path.parent for path in (written.audio, *written.subtitles)} == {written.directory}


def test_two_recordings_with_one_filename_do_not_overwrite_each_other(
    database: Database, db_settings: Settings, tmp_path: Path
) -> None:
    """A phone hands out the same name to everybody, and a flat export lost one of the two."""
    destination = tmp_path / "export"
    with database.write_session() as session:
        first = store_recording(session, db_settings, filename="voice-note.m4a")
        second = store_recording(
            session,
            db_settings,
            filename="voice-note.m4a",
            library_id=first.library_id,
            owner_id=first.uploaded_by,
        )
        written = [
            export_recording(session, audio, destination, db_settings.resolved_storage_dir)
            for audio in (first, second)
        ]
    assert written[0].audio != written[1].audio
    assert all(path.audio.read_bytes() == b"the original bytes" for path in written)


def test_punctuation_in_a_filename_cannot_separate_a_sidecar_from_its_audio(
    database: Database, db_settings: Settings, tmp_path: Path
) -> None:
    """The sidecar used to take a sanitised stem while the audio kept the raw name."""
    destination = tmp_path / "export"
    with database.write_session() as session:
        audio = store_recording(session, db_settings, filename="Grandma's talk: part 1.m4a")
        written = export_recording(session, audio, destination, db_settings.resolved_storage_dir)
    assert written.sidecar.is_file()
    assert written.audio.is_file()
    assert not any(character in written.audio.name for character in "':")
    assert {path.stem for path in written.subtitles} == {written.audio.stem}


def test_the_name_it_was_uploaded_under_survives_the_sanitised_export(
    database: Database, db_settings: Settings
) -> None:
    """A download gives back the original filename, so the sidecar has to carry it home."""
    with database.write_session() as session:
        audio = store_recording(session, db_settings, filename="Grandma's talk: part 1.m4a")
        payload = sidecar_for(session, audio)
        audio.original_filename = "Grandma-s talk- part 1.m4a"
        apply_sidecar(session, audio, payload)
        assert audio.original_filename == "Grandma's talk: part 1.m4a"


# --- What re-importing does -----------------------------------------------


def test_re_importing_the_same_transcript_does_not_add_a_second(
    database: Database, recording: str
) -> None:
    """Every transcript a recording has ever had is kept, so a duplicate reads as a second
    attempt with a better model rather than as the same one twice."""
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)

    for _ in range(2):
        with database.write_session() as session:
            again = find_by_uuid(session, recording)
            assert again is not None
            apply_sidecar(session, again, payload)

    with database.read_session() as session:
        restored = find_by_uuid(session, recording)
        assert restored is not None
        assert len(transcripts.list_transcripts(session, restored.id)) == 1


def test_a_transcript_that_says_something_else_is_still_added(
    database: Database, recording: str
) -> None:
    with database.read_session() as session:
        audio = find_by_uuid(session, recording)
        assert audio is not None
        payload = sidecar_for(session, audio)
    payload["transcript"]["segments"][1]["text"] = "Then about the harbour."

    with database.write_session() as session:
        again = find_by_uuid(session, recording)
        assert again is not None
        apply_sidecar(session, again, payload)

    with database.read_session() as session:
        restored = find_by_uuid(session, recording)
        assert restored is not None
        assert len(transcripts.list_transcripts(session, restored.id)) == 2
        active = transcripts.active_transcript(session, restored.id)
        assert active is not None
        assert transcripts.segments_of(session, active.id)[1].text == "Then about the harbour."


def test_the_category_comes_back_and_is_not_made_twice(
    database: Database, db_settings: Settings
) -> None:
    """Defect 3: the category went into the sidecar and was read back by nothing."""
    with database.write_session() as session:
        source = store_recording(session, db_settings, filename="note.m4a")
        category = Category(library_id=source.library_id, name="Interviews", position=0)
        session.add(category)
        session.flush()
        source.category_id = category.id
        payload = sidecar_for(session, source)

        elsewhere = store_recording(session, db_settings, filename="another.m4a")
        apply_sidecar(session, elsewhere, payload)
        landed = elsewhere.category_id
        assert landed is not None and landed != category.id

        apply_sidecar(session, elsewhere, payload)
        assert elsewhere.category_id == landed
        assert session.query(Category).count() == 2


def test_a_sidecar_names_the_library_the_recording_came_out_of(
    database: Database, db_settings: Settings
) -> None:
    with database.write_session() as session:
        audio = store_recording(session, db_settings, filename="note.m4a")
        payload = sidecar_for(session, audio)
        found = library_named_by(session, payload)
        assert found is not None
        assert found.id == audio.library_id


def test_a_library_in_the_trash_is_not_a_destination(
    database: Database, db_settings: Settings
) -> None:
    """Importing into a trashed library puts the recording somewhere nobody is looking."""
    with database.write_session() as session:
        audio = store_recording(session, db_settings, filename="note.m4a")
        payload = sidecar_for(session, audio)
        library = library_named_by(session, payload)
        assert library is not None
        library.deleted_at = "2026-09-20T10:00:00Z"
        session.flush()
        assert library_named_by(session, payload) is None


# --- The instance the recordings lived in -----------------------------------


@pytest.fixture
def elsewhere(tmp_path: Path) -> Iterator[Database]:
    """A second, empty instance, which is the only honest place to read an export back into."""
    settings = Settings(
        data_dir=tmp_path / "elsewhere", database_path=tmp_path / "elsewhere" / "resonand.db"
    )
    settings.prepare_directories()
    engine = build_engine(settings)
    upgrade_to_head(engine)
    try:
        yield Database(engine)
    finally:
        engine.dispose()


def two_accounts(session: Session) -> tuple[User, User]:
    first = users.create_user(session, email="a@x.test", display_name="A", is_admin=True)
    second = users.create_user(session, email="b@x.test", display_name="B")
    session.flush()
    return first, second


def shares_on(session: Session, library_id: int) -> list[tuple[str, int]]:
    return [
        (grantee.email, int(share.level))
        for share, grantee in session.execute(
            select(Share, User)
            .join(User, Share.grantee_id == User.id)
            .where(Share.library_id == library_id)
            .order_by(User.email)
        ).all()
    ]


def test_the_manifest_describes_the_accounts_and_their_libraries(database: Database) -> None:
    with database.write_session() as session:
        first, second = two_accounts(session)
        shared = libraries.create_library(session, first.id, name="Interviews", colour="amber")
        libraries.share_library(
            session, first.id, shared.uuid, grantee_id=second.id, level=Level.EDIT
        )
        manifest = manifest_for(
            session,
            [users.personal_library(session, first.id), shared],
            recordings=4,
            skipped_in_trash=1,
        )
    assert [one["email"] for one in manifest["users"]] == ["a@x.test", "b@x.test"]
    assert (manifest["recordings"], manifest["skipped_in_trash"]) == (4, 1)
    described = {one["name"]: one for one in manifest["libraries"]}
    assert described["Interviews"]["owner"] == "a@x.test"
    assert described["Interviews"]["colour"] == "amber"
    assert described["Interviews"]["shares"] == [{"grantee": "b@x.test", "level": 20}]
    assert described["Interviews"]["is_personal"] is False


def test_the_manifest_carries_no_way_to_sign_in(database: Database) -> None:
    """An export gets copied onto a stick and handed around. It describes an instance; it is
    not a way into one."""
    with database.write_session() as session:
        first, _ = two_accounts(session)
        manifest = manifest_for(
            session,
            [users.personal_library(session, first.id)],
            recordings=0,
            skipped_in_trash=0,
        )
    rendered = json.dumps(manifest).lower()
    assert "password" not in rendered
    assert "hash" not in rendered
    assert set(manifest["users"][0]) == {"email", "display_name", "is_admin"}


def test_a_shared_library_comes_back_with_its_identifier_and_its_sharing(
    database: Database, elsewhere: Database
) -> None:
    with database.write_session() as session:
        first, second = two_accounts(session)
        shared = libraries.create_library(session, first.id, name="Interviews")
        libraries.share_library(
            session, first.id, shared.uuid, grantee_id=second.id, level=Level.MANAGE
        )
        manifest = manifest_for(session, [shared], recordings=0, skipped_in_trash=0)
        wanted = shared.uuid

    with elsewhere.write_session() as session:
        two_accounts(session)
        applied = apply_manifest(session, manifest)
        assert (applied.missing_accounts, applied.refused_libraries) == ((), ())
        landed = session.get(Library, applied.libraries[wanted])
        assert landed is not None
        assert landed.uuid == wanted, "the identifier is what the sidecars point at"
        assert shares_on(session, landed.id) == [("b@x.test", 30)]


def test_a_personal_library_keeps_the_one_this_instance_made(
    database: Database, elsewhere: Database
) -> None:
    """A personal library arrives with the account, so the export's identifier cannot be adopted
    without renaming a library that may already hold this person's recordings."""
    with database.write_session() as session:
        first, _ = two_accounts(session)
        personal = users.personal_library(session, first.id)
        manifest = manifest_for(session, [personal], recordings=0, skipped_in_trash=0)
        there = personal.uuid

    with elsewhere.write_session() as session:
        first, _ = two_accounts(session)
        here = users.personal_library(session, first.id)
        applied = apply_manifest(session, manifest)
        assert here.uuid != there
        assert applied.libraries[there] == here.id


def test_a_library_whose_owner_has_no_account_is_refused_by_name(
    database: Database, elsewhere: Database
) -> None:
    """Handing it to whoever ran the import would give one person's recordings to another and
    look like it had worked."""
    with database.write_session() as session:
        _, second = two_accounts(session)
        theirs = libraries.create_library(session, second.id, name="Their interviews")
        manifest = manifest_for(session, [theirs], recordings=0, skipped_in_trash=0)

    with elsewhere.write_session() as session:
        users.create_user(session, email="a@x.test", display_name="A", is_admin=True)
        applied = apply_manifest(session, manifest)
    assert applied.libraries == {}
    assert applied.missing_accounts == ("b@x.test",)
    assert applied.refused_libraries == ("Their interviews (b@x.test)",)


def test_a_grant_to_somebody_who_is_not_here_is_reported_and_skipped(
    database: Database, elsewhere: Database
) -> None:
    with database.write_session() as session:
        first, second = two_accounts(session)
        shared = libraries.create_library(session, first.id, name="Interviews")
        libraries.share_library(
            session, first.id, shared.uuid, grantee_id=second.id, level=Level.READ
        )
        manifest = manifest_for(session, [shared], recordings=0, skipped_in_trash=0)
        wanted = shared.uuid

    with elsewhere.write_session() as session:
        users.create_user(session, email="a@x.test", display_name="A", is_admin=True)
        applied = apply_manifest(session, manifest)
        assert applied.missing_accounts == ("b@x.test",)
        assert shares_on(session, applied.libraries[wanted]) == []


def test_reading_a_manifest_twice_changes_nothing(database: Database, elsewhere: Database) -> None:
    with database.write_session() as session:
        first, second = two_accounts(session)
        shared = libraries.create_library(session, first.id, name="Interviews")
        libraries.share_library(
            session, first.id, shared.uuid, grantee_id=second.id, level=Level.EDIT
        )
        manifest = manifest_for(session, [shared], recordings=0, skipped_in_trash=0)
        wanted = shared.uuid

    with elsewhere.write_session() as session:
        two_accounts(session)
        apply_manifest(session, manifest)
        applied = apply_manifest(session, manifest)
        assert session.query(Library).count() == 3, "two personal libraries and the shared one"
        assert shares_on(session, applied.libraries[wanted]) == [("b@x.test", 20)]


def test_an_individual_share_travels_in_the_sidecar(
    database: Database, db_settings: Settings
) -> None:
    """``ING-10`` keeps these rows on purpose, so an export that dropped them would lose
    something the interface cannot yet show and the model already resolves."""
    with database.write_session() as session:
        first, second = two_accounts(session)
        library = libraries.create_library(session, first.id, name="Interviews")
        audio = store_recording(
            session,
            db_settings,
            filename="note.m4a",
            library_id=library.id,
            owner_id=first.id,
            transcript=False,
        )
        session.add(
            Share(
                library_id=None,
                audio_id=audio.id,
                grantee_id=second.id,
                level=int(Level.READ),
                granted_by=first.id,
            )
        )
        session.flush()
        payload = sidecar_for(session, audio)
    assert payload["shares"] == [{"grantee": "b@x.test", "level": 10}]


# --- Subtitles ------------------------------------------------------------


def test_vtt_and_srt_differ_only_where_the_formats_differ() -> None:
    cues = [Cue(0, 1_500, "Hello"), Cue(1_500, 3_000, "there")]
    vtt, srt = to_vtt(cues), to_srt(cues)
    assert vtt.startswith("WEBVTT")
    assert "00:00:00.000 --> 00:00:01.500" in vtt
    assert srt.startswith("1\n")
    assert "00:00:00,000 --> 00:00:01,500" in srt


def test_a_long_recording_stamps_hours_correctly() -> None:
    """A three-hour interview is the anchor use case; 03:00:00 is not 00:00:00."""
    rendered = to_vtt([Cue(3 * 3600 * 1000 + 61_500, 3 * 3600 * 1000 + 63_000, "late on")])
    assert "03:01:01.500 --> 03:01:03.000" in rendered


def test_no_cues_still_produces_a_valid_file() -> None:
    assert to_vtt([]).startswith("WEBVTT")
    assert to_srt([]) == ""
