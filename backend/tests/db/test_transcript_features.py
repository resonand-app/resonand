"""What a transcript is, as opposed to where it came from (``TRX-12``).

Provenance says which engine was asked; these say what came back. The distinction matters because
the configured engine changes while transcripts persist -- so an answer read from the instance's
current settings would describe the wrong artefact as soon as a recording has two of them.
"""

from __future__ import annotations

from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Transcript
from sonarium.db.transcripts import Origin, SegmentDraft
from sqlalchemy.orm import Session


def _audio(session: Session) -> int:
    owner = users.create_user(session, email="o@x.test", display_name="O")
    library = libraries.create_library(session, owner.id, name="L")
    return create_audio(
        session,
        library_id=library.id,
        uploaded_by=owner.id,
        storage_path="storage/aa/aa/original.m4a",
        original_filename="a.m4a",
    ).id


def test_a_transcript_with_no_speakers_says_so(database: Database) -> None:
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session,
            audio_id,
            [SegmentDraft(0, 2000, "one"), SegmentDraft(2000, 4000, "two")],
        )
        features = transcripts.features_of(session, transcript)
    assert features.has_speakers is False
    assert features.speaker_count == 0
    assert features.speakers_are_comparable is False


def test_speakers_are_counted_once_each(database: Database) -> None:
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session,
            audio_id,
            [
                SegmentDraft(0, 1000, "a", speaker="SPEAKER_00"),
                SegmentDraft(1000, 2000, "b", speaker="SPEAKER_01"),
                SegmentDraft(2000, 3000, "c", speaker="SPEAKER_00"),
            ],
            Origin(stitched_from=1),
        )
        features = transcripts.features_of(session, transcript)
    assert features.speaker_count == 2
    assert features.has_speakers is True
    assert features.speakers_are_comparable is True


def test_an_empty_speaker_is_not_a_speaker(database: Database) -> None:
    """An import can carry ``""`` where the provider parser would have written ``None``."""
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session,
            audio_id,
            [SegmentDraft(0, 1000, "a", speaker=""), SegmentDraft(1000, 2000, "b", speaker=None)],
        )
        features = transcripts.features_of(session, transcript)
    assert features.speaker_count == 0


def test_granularity_is_the_median_and_one_long_segment_does_not_move_it(
    database: Database,
) -> None:
    """The mean would report this transcript as four times as coarse as every line in it."""
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session,
            audio_id,
            [
                SegmentDraft(0, 2000, "one"),
                SegmentDraft(2000, 4000, "two"),
                SegmentDraft(4000, 6000, "three"),
                SegmentDraft(6000, 8000, "four"),
                SegmentDraft(8000, 48000, "a speech nobody interrupted"),
            ],
        )
        features = transcripts.features_of(session, transcript)
    assert features.granularity_ms == 2000


def test_a_transcript_with_no_segments_has_no_granularity(database: Database) -> None:
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(session, audio_id, [])
        features = transcripts.features_of(session, transcript)
    assert features.segment_count == 0
    assert features.granularity_ms is None


def test_speaker_labels_from_several_parts_are_not_comparable(database: Database) -> None:
    """``SPEAKER_00`` in part one is not ``SPEAKER_00`` in part four (``TRX-13``)."""
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session,
            audio_id,
            [SegmentDraft(0, 1000, "a", speaker="SPEAKER_00")],
            Origin(stitched_from=4),
        )
        features = transcripts.features_of(session, transcript)
    assert features.has_speakers is True
    assert features.speakers_are_comparable is False


def test_an_unrecorded_part_count_is_not_evidence_of_one_part(database: Database) -> None:
    """Every transcript written before this column existed reads ``NULL``, not ``1``."""
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = transcripts.create_transcript(
            session, audio_id, [SegmentDraft(0, 1000, "a", speaker="SPEAKER_00")]
        )
        features = transcripts.features_of(session, transcript)
    assert features.stitched_from is None
    assert features.speakers_are_comparable is False


def test_a_transcript_is_a_transcription_unless_it_says_otherwise(database: Database) -> None:
    with database.write_session() as session:
        audio_id = _audio(session)
        plain = transcripts.create_transcript(session, audio_id, [SegmentDraft(0, 1, "a")])
        rendered = transcripts.create_transcript(
            session, audio_id, [SegmentDraft(0, 1, "a")], Origin(task="translate")
        )
        assert transcripts.features_of(session, plain).task == "transcribe"
        assert transcripts.features_of(session, rendered).task == "translate"


def test_the_column_default_covers_a_row_written_around_the_repository(
    database: Database,
) -> None:
    """The migration backfills, so a row inserted without a task is still a transcription."""
    with database.write_session() as session:
        audio_id = _audio(session)
        transcript = Transcript(audio_id=audio_id, is_active=0, source="imported")
        session.add(transcript)
        session.flush()
        session.refresh(transcript)
        assert transcript.task == "transcribe"
