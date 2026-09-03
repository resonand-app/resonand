"""Export and re-import (``ING-11``, ``DEC-5``).

The test that matters here is the round trip. Exit criterion 4 for the first version is that
exporting the whole archive and importing it into an empty instance gives back the same thing --
and the failure mode it guards against is not losing recordings but **doubling** them, which is
what an export without stable identifiers does.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sonarium.archive import (
    SIDECAR_VERSION,
    apply_sidecar,
    export_recording,
    find_by_uuid,
    read_sidecar,
    sidecar_for,
)
from sonarium.core.config import Settings
from sonarium.db import libraries, tags, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Audio
from sonarium.db.transcripts import Origin, SegmentDraft
from sonarium.media import storage
from sonarium.media.subtitles import Cue, to_srt, to_vtt


@pytest.fixture
def recording(database: Database, db_settings: Settings) -> str:
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="",
            original_filename="Recording 2024-03-11 18.22.m4a",
        )
        path, digest = storage.store_original(
            db_settings.resolved_storage_dir,
            audio.uuid,
            [b"the original bytes"],
            filename="Recording 2024-03-11 18.22.m4a",
        )
        audio.storage_path = storage.relative(db_settings.resolved_storage_dir, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        audio.recorded_at = "2024-03-11T18:22:00"
        audio.recorded_at_offset = 60
        audio.duration_ms = 2_400_000
        tags.set_audio_tags(session, audio.id, ["family", "oral history"])
        transcripts.create_transcript(
            session,
            audio.id,
            [
                SegmentDraft(0, 4_200, "She starts by talking about the village."),
                SegmentDraft(4_200, 9_100, "Then about the factory."),
            ],
            Origin(provider="openai-compatible", model="whisper-1", language="en"),
        )
        session.flush()
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
    assert payload["sonarium"]["sidecar_version"] == SIDECAR_VERSION


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


def test_the_export_is_readable_without_this_software(
    database: Database, db_settings: Settings, recording: str, tmp_path: Path
) -> None:
    """Principle 1: the format does not need Sonarium to read it."""
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


def test_a_sidecar_from_a_future_version_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "future.sonarium.json"
    path.write_text(json.dumps({"sonarium": {"sidecar_version": 99}, "uuid": "x"}))
    with pytest.raises(ValueError, match="sidecar version 99"):
        read_sidecar(path)


def test_something_that_is_not_a_sidecar_is_refused(tmp_path: Path) -> None:
    path = tmp_path / "notes.json"
    path.write_text(json.dumps(["not", "a", "sidecar"]))
    with pytest.raises(ValueError, match="not a Sonarium sidecar"):
        read_sidecar(path)


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
