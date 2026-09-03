"""The worker, driving the real pipeline (``JOB-1``).

The point of these is the chain: an uploaded file becomes probed, drawn, transcoded and
transcribed without anybody sequencing it by hand, and a failure anywhere in it is recorded with
the real message rather than taking the worker down.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from sonarium.core.config import Settings
from sonarium.core.errors import ProviderError
from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Audio, Job
from sonarium.jobs import queue
from sonarium.jobs.handlers import Context
from sonarium.jobs.worker import Worker, drain
from sonarium.media import storage, waveform
from sonarium.transcription.contract import (
    TranscriptionHandle,
    TranscriptionRequest,
    TranscriptionResult,
    TranscriptSegment,
)
from sqlalchemy import select

from tests.media.conftest import make_audio, needs_ffmpeg


class FakeProvider:
    """An engine that answers instantly, and can be told to fail."""

    def __init__(self, *, fail_with: str | None = None) -> None:
        self.fail_with = fail_with
        self.submitted: list[TranscriptionRequest] = []

    name = "fake"
    model = "fake-1"

    def submit(self, request: TranscriptionRequest) -> TranscriptionHandle:
        self.submitted.append(request)
        if self.fail_with:
            raise ProviderError(self.fail_with)
        return TranscriptionHandle(
            provider=self.name,
            external_id="x",
            submitted_duration_ms=request.duration_ms,
            result=TranscriptionResult(
                provider=self.name,
                model=self.model,
                language="en",
                segments=(TranscriptSegment(0, 1_000, f"part starting {request.filename}"),),
            ),
        )

    def poll(self, handle: TranscriptionHandle) -> TranscriptionResult | None:
        return handle.result

    def cancel(self, handle: TranscriptionHandle) -> None:
        return None

    def close(self) -> None:
        return None


@pytest.fixture
def ingested(database: Database, db_settings: Settings, tmp_path: Path) -> tuple[str, int]:
    """A real recording, on disk and in the database, with nothing done to it yet."""
    root = db_settings.resolved_storage_dir
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="placeholder",
            original_filename="Recording 2024-03-11 18.22.wav",
        )
        source = make_audio(tmp_path / "source.wav", seconds=2.0)
        path, digest = storage.store_original(
            root, audio.uuid, [source.read_bytes()], filename="Recording 2024-03-11 18.22.wav"
        )
        audio.storage_path = storage.relative(root, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        session.flush()
        return audio.uuid, audio.id


def context_for(
    database: Database, settings: Settings, provider: FakeProvider | None = None
) -> Context:
    return Context(database=database, settings=settings, provider=provider)


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_probing_a_recording_fills_in_what_it_is_and_when_it_was_made(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    """ING-12 runs here rather than in its own job: it needs the tags ffprobe just read."""
    _, audio_id = ingested
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings))
    assert worker.run_once() is True
    with database.read_session() as session:
        audio = session.get(Audio, audio_id)
    assert audio is not None
    assert audio.duration_ms and 1_900 <= audio.duration_ms <= 2_100
    assert audio.sample_rate
    assert audio.recorded_at == "2024-03-11T18:22:00", "from the filename, as written"
    assert audio.recorded_at_offset is None, "a filename knows no timezone"


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_probing_queues_the_work_that_depends_on_it(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    """The duration probe establishes is what the waveform and the parts both need."""
    _, audio_id = ingested
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
    Worker(context_for(database, db_settings)).run_once()
    with database.read_session() as session:
        queued = {job.kind for job in session.execute(select(Job)).scalars().all()}
    assert {"waveform", "transcode"} <= queued


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_the_whole_chain_runs_without_anybody_sequencing_it(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    _, audio_id = ingested
    provider = FakeProvider()
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        queue.enqueue(session, "transcribe", audio_id=audio_id, idempotency_key="t")
    worker = Worker(context_for(database, db_settings, provider))
    assert drain(worker) >= 4
    with database.read_session() as session:
        audio = session.get(Audio, audio_id)
        transcript = transcripts.active_transcript(session, audio_id)
    assert audio is not None
    assert audio.waveform is not None, "the recording has its thumbnail"
    assert audio.derived_path is not None, "and something the browser can play"
    assert transcript is not None
    assert worker.stats.failed == 0


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_the_waveform_that_lands_is_the_one_that_can_be_read_back(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    _, audio_id = ingested
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings))
    drain(worker)
    with database.read_session() as session:
        audio = session.get(Audio, audio_id)
    assert audio is not None
    assert audio.waveform is not None
    decoded = waveform.decode(audio.waveform)
    assert decoded.peaks_per_second == db_settings.waveform_peaks_per_second
    assert decoded.pairs


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_provider_failure_is_recorded_with_its_real_message(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    """UI-15 shows this message and a retry button. An apology would leave nothing to act on."""
    _, audio_id = ingested
    provider = FakeProvider(fail_with="whisper.local refused the connection")
    with database.write_session() as session:
        queue.enqueue(session, "transcribe", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, provider))
    assert worker.run_once() is True
    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == "transcribe")).scalars().one()
    assert job.error is not None
    assert "whisper.local refused" in job.error
    assert job.state == queue.PENDING, "it will be tried again"


def test_a_job_with_no_handler_fails_instead_of_spinning(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    _, audio_id = ingested
    with database.write_session() as session:
        queue.enqueue(session, "telepathy", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings))
    assert worker.run_once() is True
    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == "telepathy")).scalars().one()
    assert job.state == queue.FAILED
    assert "no handler" in (job.error or "")


def test_a_handler_that_raises_does_not_take_the_worker_down(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    _, audio_id = ingested
    with database.write_session() as session:
        job = queue.enqueue(session, "probe", audio_id=audio_id)
        assert job is not None
        missing = session.get(Audio, audio_id)
        assert missing is not None
        missing.storage_path = "aa/gone/original.m4a"
    worker = Worker(context_for(database, db_settings))
    assert worker.run_once() is True
    assert worker.stats.completed == 0
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id, idempotency_key="again")
    assert worker.run_once() is True, "the worker is still working"


def test_an_empty_queue_is_not_an_error(database: Database, db_settings: Settings) -> None:
    assert Worker(context_for(database, db_settings)).run_once() is False


def test_starting_the_worker_recovers_what_the_last_process_was_holding(
    database: Database, db_settings: Settings, ingested: tuple[str, int]
) -> None:
    _, audio_id = ingested
    with database.write_session() as session:
        queue.enqueue(session, "probe", audio_id=audio_id)
        queue.claim(session)
    worker = Worker(context_for(database, db_settings))
    worker.start()
    worker.stop(timeout=2.0)
    with database.read_session() as session:
        probe = session.execute(select(Job).where(Job.kind == "probe")).scalars().one()
    assert probe.state != queue.RUNNING
