"""Where ``sonarium import`` puts a recording, and which sidecar it believes (``ING-11``).

The placement is the part that only exists in the command. ``apply_sidecar`` is covered in
``tests/test_archive.py``; what is covered here is the decision in front of it -- the library a
recording goes into when nobody named one, and the refusal to hand one directory's sidecar to
every file in it.

The whole-archive round trip, which is exit criterion 4, is ``ING-11b`` and is not this.
"""

from __future__ import annotations

import shutil
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

import pytest
from sonarium.archive import export_recording, find_by_uuid
from sonarium.cli.main import app
from sonarium.core.config import reset_settings_cache
from sonarium.db import libraries, tags, users
from sonarium.db.audio import create_audio
from sonarium.db.models import Audio
from sonarium.media import storage
from typer.testing import CliRunner

if TYPE_CHECKING:
    from sonarium.core.config import Settings
    from sonarium.db.engine import Database

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

    monkeypatch.setenv("SONARIUM_DATA_DIR", str(db_settings.data_dir))
    monkeypatch.setenv("SONARIUM_DATABASE_PATH", str(db_settings.resolved_database_path))
    monkeypatch.setenv("SONARIUM_SECRET_KEY", "0" * 64)
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
    shutil.copyfile(instance.export / instance.uuid / "sonarium.json", crowded / "sonarium.json")
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


def libraries_of(session: object, audio: Audio) -> str:
    from sonarium.db.models import Library  # noqa: PLC0415 -- one assertion needs the name

    library = session.get(Library, audio.library_id)  # type: ignore[attr-defined]
    assert library is not None
    return str(library.name)
