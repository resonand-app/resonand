"""Where ``resonand import`` puts a recording, and which sidecar it believes (``ING-11``).

The placement is the part that only exists in the command. ``apply_sidecar`` is covered in
``tests/test_archive.py``; what is covered here is the decision in front of it -- the library a
recording goes into when nobody named one, and the refusal to hand one directory's sidecar to
every file in it.

The whole-archive round trip, which is exit criterion 4, is ``ING-11b`` and is not this.
"""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from resonand.archive import export_recording, find_by_uuid
from resonand.cli.main import app
from resonand.core.config import reset_settings_cache
from resonand.db import libraries, tags, users
from resonand.db.audio import create_audio
from resonand.db.models import Audio, Library
from resonand.media import storage
from sqlalchemy import text
from sqlalchemy.orm import Session
from typer.testing import CliRunner

if TYPE_CHECKING:
    from resonand.core.config import Settings
    from resonand.db.engine import Database

runner = CliRunner()


@dataclass(frozen=True, slots=True)
class Instance:
    """One recording, its library, and where an export of it was written."""

    uuid: str
    library_uuid: str
    export: Path


@pytest.fixture
def instance(
    database: Database, db_settings: Settings, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Iterator[Instance]:
    export = tmp_path / "export"
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="",
            original_filename="note.m4a",
        )
        path, digest = storage.store_original(
            db_settings.resolved_storage_dir,
            audio.uuid,
            [b"the original bytes"],
            filename="note.m4a",
        )
        audio.storage_path = storage.relative(db_settings.resolved_storage_dir, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        tags.set_audio_tags(session, audio.id, ["family"])
        session.flush()
        export_recording(session, audio, export, db_settings.resolved_storage_dir)
        found = Instance(uuid=audio.uuid, library_uuid=library.uuid, export=export)

    monkeypatch.setenv("RESONAND_DATA_DIR", str(db_settings.data_dir))
    monkeypatch.setenv("RESONAND_DATABASE_PATH", str(db_settings.resolved_database_path))
    monkeypatch.setenv("RESONAND_SECRET_KEY", "0" * 64)
    reset_settings_cache()
    yield found
    reset_settings_cache()


def forget(database: Database, db_settings: Settings, uuid: str) -> None:
    """Take a recording out of the archive, row and bytes, leaving its library behind."""
    with database.write_session() as session:
        audio = find_by_uuid(session, uuid)
        assert audio is not None
        session.delete(audio)
    storage.delete_recording(db_settings.resolved_storage_dir, uuid)


def test_a_recording_goes_back_into_the_library_its_sidecar_names(
    instance: Instance, database: Database, db_settings: Settings
) -> None:
    """Without this the whole archive lands in whichever library ``--library`` happened to name."""
    forget(database, db_settings, instance.uuid)

    result = runner.invoke(app, ["import", str(instance.export)])

    assert result.exit_code == 0, result.output
    with database.read_session() as session:
        restored = find_by_uuid(session, instance.uuid)
        assert restored is not None
        assert restored.original_filename == "note.m4a"
        assert libraries_of(session, restored) == "Family"


def test_a_file_that_names_no_library_and_is_given_none_is_skipped(
    instance: Instance, tmp_path: Path
) -> None:
    loose = tmp_path / "loose"
    loose.mkdir()
    (loose / "somebody-elses.m4a").write_bytes(b"bytes from elsewhere")

    result = runner.invoke(app, ["import", str(loose)])

    assert result.exit_code == 0, result.output
    assert "pass --library" in result.output


def test_one_sidecar_does_not_claim_every_file_in_a_directory(
    instance: Instance, database: Database, tmp_path: Path
) -> None:
    """A folder of loose files with a sidecar dropped in would otherwise give them all one uuid,
    and the second file would update what the first had just created."""
    crowded = tmp_path / "crowded"
    crowded.mkdir()
    shutil.copyfile(instance.export / instance.uuid / "resonand.json", crowded / "resonand.json")
    (crowded / "first.m4a").write_bytes(b"one")
    (crowded / "second.m4a").write_bytes(b"two")

    result = runner.invoke(app, ["import", str(crowded), "--library", instance.library_uuid])

    assert result.exit_code == 0, result.output
    with database.read_session() as session:
        every = session.query(Audio).all()
    assert len(every) == 3, "the two loose files arrived as recordings of their own"
    assert [audio.original_filename for audio in every[1:]] == ["first.m4a", "second.m4a"]


def test_a_dry_run_says_which_library_it_would_use(
    instance: Instance, database: Database, db_settings: Settings
) -> None:
    forget(database, db_settings, instance.uuid)

    result = runner.invoke(app, ["import", str(instance.export), "--dry-run"])

    assert result.exit_code == 0, result.output
    assert "would add to Family" in result.output


def test_a_dry_run_says_when_it_would_skip(instance: Instance, tmp_path: Path) -> None:
    loose = tmp_path / "loose"
    loose.mkdir()
    (loose / "somebody-elses.m4a").write_bytes(b"bytes from elsewhere")

    result = runner.invoke(app, ["import", str(loose), "--dry-run"])

    assert result.exit_code == 0, result.output
    assert "would skip" in result.output


# --- A recording that is in the trash (BUG-5) --------------------------------


def retitle(instance: Instance, title: str) -> None:
    """Change the title the exported sidecar carries, so a re-import has something to apply."""
    sidecar = instance.export / instance.uuid / "resonand.json"
    payload = json.loads(sidecar.read_text(encoding="utf-8"))
    payload["title"] = title
    sidecar.write_text(json.dumps(payload), encoding="utf-8")


def trash(database: Database, uuid: str, *, library_too: bool = False) -> None:
    with database.write_session() as session:
        audio = find_by_uuid(session, uuid)
        assert audio is not None
        audio.deleted_at = "2026-10-31T09:00:00Z"
        if library_too:
            library = session.get(Library, audio.library_id)
            assert library is not None
            library.deleted_at = "2026-10-31T09:00:00Z"


def indexed(session: Session, audio: Audio) -> bool:
    found = session.execute(
        text("SELECT rowid FROM audio_fts WHERE rowid = :id"), {"id": audio.id}
    ).first()
    return found is not None


def test_an_update_onto_a_live_recording_reads_as_it_always_has(
    instance: Instance, database: Database
) -> None:
    """Scripts read this line, so a recording nobody trashed must not change it."""
    retitle(instance, "Renamed")

    result = runner.invoke(app, ["import", str(instance.export)])

    assert result.exit_code == 0, result.output
    assert result.output.splitlines()[-1] == "Imported 0 recordings, updated 1."


def test_an_update_onto_a_trashed_recording_leaves_it_there_and_says_so(
    instance: Instance, database: Database
) -> None:
    """Counted as a plain update, it read as success while the recording stayed out of sight
    and went on counting down to its purge."""
    trash(database, instance.uuid)
    retitle(instance, "Renamed")

    result = runner.invoke(app, ["import", str(instance.export)])

    assert result.exit_code == 0, result.output
    assert "which is in the trash: pass --restore" in result.output
    assert "updated 1 (1 still in the trash)." in result.output
    with database.read_session() as session:
        audio = find_by_uuid(session, instance.uuid)
        assert audio is not None
        assert audio.title == "Renamed"
        assert audio.deleted_at is not None, "trashing it was a decision the import did not see"
        assert not indexed(session, audio)


def test_restore_takes_a_trashed_recording_back_out(instance: Instance, database: Database) -> None:
    trash(database, instance.uuid)
    retitle(instance, "Renamed")

    result = runner.invoke(app, ["import", str(instance.export), "--restore"])

    assert result.exit_code == 0, result.output
    assert "updated 1 (1 taken out of the trash)." in result.output
    with database.read_session() as session:
        audio = find_by_uuid(session, instance.uuid)
        assert audio is not None
        assert (audio.title, audio.deleted_at) == ("Renamed", None)
        assert indexed(session, audio), "a restored recording is found by search again"


def test_restore_does_not_bring_back_a_trashed_library(
    instance: Instance, database: Database
) -> None:
    """Restoring the library would bring back everything in it, which is not what one file asks."""
    trash(database, instance.uuid, library_too=True)

    result = runner.invoke(app, ["import", str(instance.export), "--restore"])

    assert result.exit_code == 0, result.output
    assert "its library Family is in the trash" in result.output
    assert "updated 1 (1 still in the trash)." in result.output
    with database.read_session() as session:
        audio = find_by_uuid(session, instance.uuid)
        assert audio is not None
        library = session.get(Library, audio.library_id)
        assert library is not None
        assert library.deleted_at is not None


@pytest.mark.parametrize(
    ("flags", "verdict"),
    [
        ([], "would update (in the trash)"),
        (["--restore"], "would update and take out of the trash"),
    ],
)
def test_a_dry_run_says_when_the_recording_is_in_the_trash(
    instance: Instance, database: Database, flags: list[str], verdict: str
) -> None:
    trash(database, instance.uuid)

    result = runner.invoke(app, ["import", str(instance.export), "--dry-run", *flags])

    assert result.exit_code == 0, result.output
    assert f"{verdict}: " in result.output
    with database.read_session() as session:
        audio = find_by_uuid(session, instance.uuid)
        assert audio is not None
        assert audio.deleted_at is not None


# --- When there is no manifest to read --------------------------------------


def test_an_import_pointed_above_an_export_says_where_the_manifest_is(
    instance: Instance, tmp_path: Path
) -> None:
    """``ING-11c1``. One directory too high is the ordinary mistake, and every recording then
    reports the same thing -- that it has no library -- which is the symptom and not the cause."""
    outer = tmp_path / "outer"
    assert runner.invoke(app, ["export", str(outer / "export")]).exit_code == 0

    result = runner.invoke(app, ["import", str(outer), "--dry-run"])

    assert result.exit_code == 0, result.output
    assert f"{outer} carries no resonand-archive.json" in result.output
    assert str(outer / "export") in result.output


def test_an_import_with_nothing_to_place_recordings_in_says_so_once(
    instance: Instance, tmp_path: Path
) -> None:
    loose = tmp_path / "loose"
    loose.mkdir()
    (loose / "somebody-elses.m4a").write_bytes(b"bytes from elsewhere")

    result = runner.invoke(app, ["import", str(loose), "--dry-run"])

    assert result.exit_code == 0, result.output
    assert result.output.count("carries no resonand-archive.json") == 1
    assert "Pass --library <uuid>" in result.output


def test_loose_files_going_somewhere_named_are_not_told_about_manifests(
    instance: Instance, tmp_path: Path
) -> None:
    """Importing a folder of recordings into a library you named is an ordinary thing to do, not
    a mistake to explain."""
    loose = tmp_path / "loose"
    loose.mkdir()
    (loose / "somebody-elses.m4a").write_bytes(b"bytes from elsewhere")

    result = runner.invoke(app, ["import", str(loose), "--library", instance.library_uuid])

    assert result.exit_code == 0, result.output
    assert "resonand-archive.json" not in result.output


# --- An export written before the rename (NAM-4) -----------------------------


def age(export: Path) -> None:
    """Rewrite an export into the format this project wrote before it was renamed."""
    for path in sorted(export.rglob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        payload["sonarium"] = payload.pop("resonand")
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        path.rename(path.with_name(path.name.replace("resonand", "sonarium")))


def test_an_export_written_before_the_rename_still_imports(
    instance: Instance, database: Database, db_settings: Settings, tmp_path: Path
) -> None:
    """``NAM-4``. An export is the one artefact built to outlive the instance that wrote it, so a
    reader that refused last month's spelling would undercut the claim it rests on."""
    export = tmp_path / "old"
    assert runner.invoke(app, ["export", str(export)]).exit_code == 0
    age(export)
    assert (export / "sonarium-archive.json").is_file()
    forget(database, db_settings, instance.uuid)

    result = runner.invoke(app, ["import", str(export)])

    assert result.exit_code == 0, result.output
    # The file it read, not the one this build writes: naming the wrong one sends somebody
    # looking for a file that is not there.
    assert "from sonarium-archive.json" in result.output
    with database.read_session() as session:
        restored = find_by_uuid(session, instance.uuid)
        assert restored is not None
        assert libraries_of(session, restored) == "Family"


def test_an_export_written_now_carries_only_the_new_names(
    instance: Instance, tmp_path: Path
) -> None:
    """The fallback is a reader, never a writer: nothing this build emits carries the old name."""
    export = tmp_path / "current"
    assert runner.invoke(app, ["export", str(export)]).exit_code == 0

    written = sorted(export.rglob("*.json"))
    assert written
    for path in written:
        assert "sonarium" not in path.name
        assert "sonarium" not in path.read_text(encoding="utf-8")


def test_a_sidecar_suffixed_with_the_old_name_is_still_found(
    instance: Instance, database: Database, db_settings: Settings, tmp_path: Path
) -> None:
    """The hand-written shape rather than the exported one: one recording, one sidecar named
    after it, sitting in a directory this command was simply pointed at."""
    loose = tmp_path / "loose"
    loose.mkdir()
    directory = instance.export / instance.uuid
    audio = next(one for one in directory.iterdir() if one.suffix == ".m4a")
    shutil.copy(audio, loose / audio.name)
    payload = json.loads((directory / "resonand.json").read_text(encoding="utf-8"))
    payload["sonarium"] = payload.pop("resonand")
    (loose / f"{audio.stem}.sonarium.json").write_text(json.dumps(payload), encoding="utf-8")
    forget(database, db_settings, instance.uuid)

    result = runner.invoke(app, ["import", str(loose)])

    assert result.exit_code == 0, result.output
    with database.read_session() as session:
        assert find_by_uuid(session, instance.uuid) is not None


def libraries_of(session: object, audio: Audio) -> str:
    library = session.get(Library, audio.library_id)  # type: ignore[attr-defined]
    assert library is not None
    return str(library.name)
