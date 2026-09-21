"""Exit criterion 4: the whole archive out, into an empty instance, and back (``ING-11b``).

Everything else about the export is tested a piece at a time. This is the one test that runs both
commands, because the failure this guards against lives between them: an export that writes
something no import reads, or an import that quietly puts everything in one place. Three of the
four defects ``ING-11a`` fixed would have been caught here and were not, because nothing exported
anything and then imported it.

The archive it builds is the shape a real instance has -- two people, a personal library each and
two more shared in opposite directions -- because the interesting failure is structural, and one
user with one library cannot express it.

What this does **not** claim: that an export restores an instance. Accounts are created by hand
first, on purpose (``ING-11c``), and credentials never travel. Restoring an instance whole is
``OPS-6``'s backup.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from resonand.cli.main import app
from resonand.core.config import Settings, reset_settings_cache
from resonand.core.levels import Level
from resonand.db import libraries, tags, transcripts, users
from resonand.db.audio import create_audio
from resonand.db.engine import Database, build_engine
from resonand.db.migrate import upgrade_to_head
from resonand.db.models import Audio, Library, Share, Transcript, User
from resonand.db.transcripts import Origin, SegmentDraft
from resonand.media import storage
from sqlalchemy import select
from sqlalchemy.orm import Session
from typer.testing import CliRunner

if TYPE_CHECKING:
    from typer.testing import Result

runner = CliRunner()

PASSWORD = "a-password-nobody-will-guess"


@dataclass(frozen=True, slots=True)
class Archive:
    """What went in, so the far side can be compared against it rather than against a guess."""

    recordings: dict[str, str]
    """Recording uuid to the name of the library it was in."""

    trashed: str
    shared_uuids: dict[str, str]
    """Library name to uuid, for the two that are not personal."""


Command = Callable[[list[str], Settings], "Result"]


@pytest.fixture
def run(monkeypatch: pytest.MonkeyPatch) -> Iterator[Command]:
    """Run one command against one instance, and leave the environment as it was found.

    Two instances in one test means the environment is what decides which, and it is undone at
    the end: a ``RESONAND_*`` left behind here points the next test at this test's archive.
    """

    def invoke(arguments: list[str], settings: Settings) -> Result:
        monkeypatch.setenv("RESONAND_DATA_DIR", str(settings.data_dir))
        monkeypatch.setenv("RESONAND_DATABASE_PATH", str(settings.resolved_database_path))
        monkeypatch.setenv("RESONAND_SECRET_KEY", "0" * 64)
        reset_settings_cache()
        return runner.invoke(app, arguments)

    yield invoke
    reset_settings_cache()


def store(
    session: Session, settings: Settings, *, library: Library, owner: User, filename: str
) -> Audio:
    audio = create_audio(
        session,
        library_id=library.id,
        uploaded_by=owner.id,
        storage_path="",
        original_filename=filename,
    )
    path, digest = storage.store_original(
        settings.resolved_storage_dir, audio.uuid, [filename.encode()], filename=filename
    )
    audio.storage_path = storage.relative(settings.resolved_storage_dir, path)
    audio.sha256 = digest.sha256
    audio.size_bytes = digest.size_bytes
    return audio


@pytest.fixture
def here(database: Database, db_settings: Settings) -> Archive:
    """Two people, four libraries, shares in both directions, and one recording in the trash."""
    with database.write_session() as session:
        one = users.create_user(session, email="a@x.test", display_name="A", is_admin=True)
        two = users.create_user(session, email="b@x.test", display_name="B")
        session.flush()
        mine = users.personal_library(session, one.id)
        theirs = users.personal_library(session, two.id)
        interviews = libraries.create_library(session, one.id, name="Interviews", colour="amber")
        field = libraries.create_library(session, two.id, name="Field notes")
        libraries.share_library(
            session, one.id, interviews.uuid, grantee_id=two.id, level=Level.EDIT
        )
        libraries.share_library(session, two.id, field.uuid, grantee_id=one.id, level=Level.READ)

        placed: dict[str, str] = {}
        for library, owner, filename in (
            (mine, one, "mine.m4a"),
            (theirs, two, "theirs.m4a"),
            (interviews, one, "grandmother.m4a"),
            (interviews, one, "second afternoon.m4a"),
            (field, two, "the harbour.m4a"),
        ):
            audio = store(session, db_settings, library=library, owner=owner, filename=filename)
            placed[audio.uuid] = library.name

        detailed = session.execute(
            select(Audio).where(Audio.original_filename == "grandmother.m4a")
        ).scalar_one()
        detailed.title = "Grandmother, first afternoon"
        detailed.recorded_at = "2024-03-11T18:22:00"
        detailed.recorded_at_offset = 60
        tags.set_audio_tags(session, detailed.id, ["family", "oral history"])
        transcripts.create_transcript(
            session,
            detailed.id,
            [SegmentDraft(0, 4_200, "She starts by talking about the village.")],
            Origin(provider="openai-compatible", model="whisper-1", language="en"),
        )

        gone = store(session, db_settings, library=mine, owner=one, filename="deleted.m4a")
        gone.deleted_at = "2026-09-20T10:00:00Z"
        session.flush()
        return Archive(
            recordings=placed,
            trashed=gone.uuid,
            shared_uuids={"Interviews": interviews.uuid, "Field notes": field.uuid},
        )


@pytest.fixture
def empty(tmp_path: Path) -> Iterator[Settings]:
    """An instance with the schema and nothing else, which is what criterion 4 names."""
    settings = Settings(
        data_dir=tmp_path / "empty", database_path=tmp_path / "empty" / "resonand.db"
    )
    settings.prepare_directories()
    engine = build_engine(settings)
    upgrade_to_head(engine)
    engine.dispose()
    yield settings
    reset_settings_cache()


def test_the_whole_archive_round_trips_into_an_empty_instance(
    here: Archive, run: Command, db_settings: Settings, empty: Settings, tmp_path: Path
) -> None:
    export = tmp_path / "export"

    written = run(["export", str(export)], db_settings)
    assert written.exit_code == 0, written.output
    assert "Exported 5 recordings" in written.output

    # The two accounts are created first and by hand, which is the documented procedure: an
    # export names who somebody was and never how they sign in. The second would be made in the
    # administration panel; there is no CLI for a non-administrator.
    created = run(
        ["create-admin", "--email", "a@x.test", "--display-name", "A", "--password", PASSWORD],
        empty,
    )
    assert created.exit_code == 0, created.output
    far = Database(build_engine(empty))
    with far.write_session() as session:
        users.create_user(session, email="b@x.test", display_name="B")

    read_back = run(["import", str(export)], empty)
    assert read_back.exit_code == 0, read_back.output
    assert "Imported 5 recordings, updated 0." in read_back.output
    assert "no account here" not in read_back.output

    with far.read_session() as session:
        landed = {
            audio.uuid: session.get(Library, audio.library_id)
            for audio in session.execute(select(Audio)).scalars().all()
        }
        assert set(landed) == set(here.recordings), "every recording, and nothing extra"
        assert here.trashed not in landed, "the trash is not part of an export"
        assert {uuid: library.name for uuid, library in landed.items() if library} == (
            here.recordings
        )
        for name, uuid in here.shared_uuids.items():
            library = session.execute(
                select(Library).where(Library.uuid == uuid)
            ).scalar_one_or_none()
            assert library is not None, f"{name} kept the identifier its sidecars point at"
        assert _sharing(session) == {
            ("Interviews", "b@x.test"): int(Level.EDIT),
            ("Field notes", "a@x.test"): int(Level.READ),
        }
        detailed = session.execute(
            select(Audio).where(Audio.title == "Grandmother, first afternoon")
        ).scalar_one()
        assert detailed.original_filename == "grandmother.m4a"
        assert detailed.recorded_at == "2024-03-11T18:22:00"
        assert detailed.recorded_at_offset == 60
        assert sorted(tag.name for tag in tags.tags_for_audio(session, detailed.id)) == [
            "family",
            "oral history",
        ]
        transcript = transcripts.active_transcript(session, detailed.id)
        assert transcript is not None
        assert transcripts.segments_of(session, transcript.id)[0].text == (
            "She starts by talking about the village."
        )
    far.engine.dispose()

    checked = run(["fsck"], empty)
    assert checked.exit_code == 0, checked.output
    assert "all present and unchanged" in checked.output


def test_reading_the_same_export_twice_does_not_double_the_archive(
    here: Archive, run: Command, db_settings: Settings, empty: Settings, tmp_path: Path
) -> None:
    """The failure this whole format guards against is not losing recordings but doubling them."""
    export = tmp_path / "export"
    assert run(["export", str(export)], db_settings).exit_code == 0
    run(
        ["create-admin", "--email", "a@x.test", "--display-name", "A", "--password", PASSWORD],
        empty,
    )
    far = Database(build_engine(empty))
    with far.write_session() as session:
        users.create_user(session, email="b@x.test", display_name="B")

    assert run(["import", str(export)], empty).exit_code == 0
    again = run(["import", str(export)], empty)
    assert again.exit_code == 0, again.output
    assert "Imported 0 recordings, updated 5." in again.output

    with far.read_session() as session:
        assert session.query(Audio).count() == 5
        assert session.query(Library).count() == 4
        assert session.query(Share).count() == 2
        assert session.query(Transcript).count() == 1
    far.engine.dispose()


def test_an_export_read_without_its_accounts_refuses_by_name(
    here: Archive, run: Command, db_settings: Settings, empty: Settings, tmp_path: Path
) -> None:
    """Placing somebody else's recordings in the importer's own library would look like it had
    worked, and would hand one person's archive to another."""
    export = tmp_path / "export"
    assert run(["export", str(export)], db_settings).exit_code == 0
    run(
        ["create-admin", "--email", "a@x.test", "--display-name", "A", "--password", PASSWORD],
        empty,
    )

    read_back = run(["import", str(export)], empty)

    assert read_back.exit_code == 0, read_back.output
    assert "no account here for b@x.test" in read_back.output
    assert "Field notes" in read_back.output
    far = Database(build_engine(empty))
    with far.read_session() as session:
        assert session.query(Share).count() == 0
        placed = session.execute(select(Audio)).scalars().all()
        assert len(placed) == 3, "A's own recordings arrived; B's had nowhere to go"
    far.engine.dispose()


def _sharing(session: Session) -> dict[tuple[str, str], int]:
    return {
        (library.name, grantee.email): int(share.level)
        for share, library, grantee in session.execute(
            select(Share, Library, User)
            .join(Library, Share.library_id == Library.id)
            .join(User, Share.grantee_id == User.id)
        ).all()
    }
