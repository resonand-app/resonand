"""The worker, driving the real pipeline (``JOB-1``).

The point of these is the chain: an uploaded file becomes probed, drawn, transcoded and
transcribed without anybody sequencing it by hand, and a failure anywhere in it is recorded with
the real message rather than taking the worker down.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

import pytest
from sonarium.core.config import Settings
from sonarium.core.errors import ProviderError
from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.models import Audio, Job
from sonarium.jobs import handlers, queue
from sonarium.jobs.handlers import Context
from sonarium.jobs.worker import Worker, drain
from sonarium.media import storage, waveform
from sonarium.transcription.capabilities import Capabilities
from sonarium.transcription.chunking import Plan, restitch
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

    def __init__(
        self,
        *,
        fail_with: str | None = None,
        segments: tuple[TranscriptSegment, ...] | None = None,
        capabilities: Capabilities | None = None,
    ) -> None:
        self.fail_with = fail_with
        self.segments = segments
        self.submitted: list[TranscriptionRequest] = []
        self.declared = capabilities or Capabilities()

    name = "fake"
    model = "fake-1"

    @property
    def capabilities(self) -> Capabilities:
        return self.declared

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
                segments=self.segments
                or (TranscriptSegment(0, 1_000, f"part starting {request.filename}"),),
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


@pytest.fixture
def stored(database: Database, db_settings: Settings) -> tuple[str, int]:
    """A recording on disk whose bytes are not audio.

    A recording short enough to go to the provider in one part is never decoded on the way, so a
    test about what the provider answers does not need ffmpeg to have made the file.
    """
    root = db_settings.resolved_storage_dir
    with database.write_session() as session:
        owner = users.create_user(session, email="p@x.test", display_name="P")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="placeholder",
            original_filename="note.wav",
        )
        path, digest = storage.store_original(
            root, audio.uuid, [b"pretend this is a recording"], filename="note.wav"
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
    assert audio.recorded_at_source == "filename"


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


def test_a_provider_that_returns_impossible_timings_stores_no_transcript(
    database: Database, db_settings: Settings, stored: tuple[str, int]
) -> None:
    """``REV-6``: the check on the timings had no caller on this path at all.

    An end before its start is not a transcript that is slightly wrong -- it reads correctly and
    seeks to the wrong place, which nobody would report as a bug against the provider. The job
    carries the message instead.
    """
    _, audio_id = stored
    provider = FakeProvider(segments=(TranscriptSegment(5_000, 1_000, "backwards"),))
    with database.write_session() as session:
        queue.enqueue(session, "transcribe", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, provider))
    assert worker.run_once() is True
    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == "transcribe")).scalars().one()
        assert transcripts.list_transcripts(session, audio_id) == []
    assert "timed impossibly" in (job.error or "")
    assert worker.stats.completed == 0


def test_a_provider_that_answers_sensibly_still_gets_its_transcript(
    database: Database, db_settings: Settings, stored: tuple[str, int]
) -> None:
    """The other side of the same guard: it refuses the impossible and nothing else."""
    _, audio_id = stored
    provider = FakeProvider(segments=(TranscriptSegment(0, 1_000, "hello"),))
    with database.write_session() as session:
        queue.enqueue(session, "transcribe", audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, provider))
    assert worker.run_once() is True
    with database.read_session() as session:
        transcript = transcripts.active_transcript(session, audio_id)
    assert transcript is not None
    assert worker.stats.completed == 1


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


# --- Giving up on one while it runs --------------------------------------


class CancellingProvider(FakeProvider):
    """A provider that stands in for somebody pressing cancel while the audio is away.

    Cancelling happens from a request thread, seconds into work that takes minutes, and there is
    no other point in the handler where a test can be sure the job is mid-flight.
    """

    def __init__(self, database: Database, *, after_parts: int = 0) -> None:
        super().__init__()
        self._database = database
        self._after_parts = after_parts

    def submit(self, request: TranscriptionRequest) -> TranscriptionHandle:
        # Before delegating, so that a provider told to fail cancels first and the handler meets
        # both things at once -- which is the case the second test is about.
        if len(self.submitted) >= self._after_parts:
            with self._database.write_session() as session:
                job = (
                    session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE))
                    .scalars()
                    .one()
                )
                queue.cancel(session, job.id)
        return super().submit(request)


def test_a_transcription_cancelled_while_it_runs_leaves_no_transcript(
    database: Database, db_settings: Settings, stored: tuple[str, int]
) -> None:
    """The half of cancelling that is not the row (``API-21``).

    A handler is not killed, so it returns normally whether it stopped early or ran to the end.
    Without the check before the write, the provider's answer to work somebody had already
    stopped would land as the recording's words, and the job would be marked done on top of its
    own cancellation.
    """
    _, audio_id = stored
    provider = CancellingProvider(database)
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, provider))

    assert worker.run_once() is True

    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE)).scalars().one()
        transcript = transcripts.active_transcript(session, audio_id)
    assert job.state == queue.CANCELLED, "finishing must not undo a cancellation"
    assert transcript is None
    assert worker.stats.completed == 0
    assert worker.stats.cancelled == 1


def test_a_transcription_cancelled_as_it_is_written_still_leaves_no_transcript(
    database: Database,
    db_settings: Settings,
    stored: tuple[str, int],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The instant between asking and writing (``API-21``).

    A check that has already released its session is a check about the past: a cancellation
    arriving after it and before the write was answered with the transcript it was meant to
    prevent, and a recording that has one reads ``done`` whatever its own job says. So the last
    one is asked inside the transaction that writes, which holds the write lock while it asks.

    ``restitch`` stands in for that instant, being the last thing to run before the write session
    opens.
    """
    _, audio_id = stored

    def cancel_then_stitch(
        plan: Plan, results: Sequence[Sequence[TranscriptSegment]]
    ) -> tuple[TranscriptSegment, ...]:
        with database.write_session() as session:
            job = (
                session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE))
                .scalars()
                .one()
            )
            queue.cancel(session, job.id)
        return restitch(plan, results)

    monkeypatch.setattr(handlers, "restitch", cancel_then_stitch)
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, FakeProvider()))

    assert worker.run_once() is True

    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE)).scalars().one()
        transcript = transcripts.active_transcript(session, audio_id)
    assert transcript is None, "a cancellation must not be outrun by the write it stops"
    assert job.state == queue.CANCELLED
    assert worker.stats.cancelled == 1


def test_a_cancelled_transcription_is_not_a_failure_worth_retrying(
    database: Database, db_settings: Settings, stored: tuple[str, int]
) -> None:
    """A provider that breaks after the cancellation must not put the job back on the queue.

    Somebody who pressed cancel would otherwise watch the transcription start again by itself,
    which is the opposite of what they asked for.
    """
    _, audio_id = stored
    provider = CancellingProvider(database)
    provider.fail_with = "whisper.local refused the connection"
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)
    worker = Worker(context_for(database, db_settings, provider))

    assert worker.run_once() is True

    with database.read_session() as session:
        job = session.execute(select(Job).where(Job.kind == queue.KIND_TRANSCRIBE)).scalars().one()
    assert job.state == queue.CANCELLED
    assert worker.stats.retried == 0
    assert worker.stats.cancelled == 1


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_an_engine_that_takes_the_whole_recording_is_sent_it_whole(
    database: Database, tmp_path: Path
) -> None:
    """``TRX-3``: the ceiling comes from the engine, not from a number the operator guessed.

    The instance is configured to split at five seconds, which is what it does for an engine that
    says nothing. An engine declaring that it takes an hour is handed the thirty seconds in one
    request -- which is four requests saved, four times less failure surface, and on a
    per-request biller four minimums instead of one.
    """
    settings = Settings(
        data_dir=tmp_path / "instance",
        database_path=tmp_path / "instance" / "sonarium.db",
        transcription_max_part_seconds=5,
    )
    root = settings.resolved_storage_dir
    with database.write_session() as session:
        owner = users.create_user(session, email="w@x.test", display_name="W")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="placeholder",
            original_filename="long.wav",
        )
        source = make_audio(tmp_path / "long.wav", seconds=30.0)
        path, digest = storage.store_original(
            root, audio.uuid, [source.read_bytes()], filename="long.wav"
        )
        audio.storage_path = storage.relative(root, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        audio.duration_ms = 30_000
        session.flush()
        audio_id = audio.id

    undeclared = FakeProvider()
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)
    assert Worker(context_for(database, settings, undeclared)).run_once() is True
    assert len(undeclared.submitted) > 1, "five-second parts, because nothing was declared"

    generous = FakeProvider(capabilities=Capabilities(max_duration_ms=3_600_000))
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)
    assert Worker(context_for(database, settings, generous)).run_once() is True
    assert len(generous.submitted) == 1


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_cancelled_transcription_stops_sending_the_parts_that_are_left(
    database: Database, tmp_path: Path
) -> None:
    """The half of cancelling that is about egress (``API-21``, principle 2).

    An hour of audio is a dozen requests over several minutes. Somebody who cancels during the
    second one is asking for the other ten not to be sent, so a cancellation that only stopped
    the transcript being written would still have paid the provider and still have sent the
    audio -- which is the part no refund undoes.
    """
    settings = Settings(
        data_dir=tmp_path / "instance",
        database_path=tmp_path / "instance" / "sonarium.db",
        # Five-second parts so a recording short enough to generate in a test still splits.
        transcription_max_part_seconds=5,
    )
    root = settings.resolved_storage_dir
    with database.write_session() as session:
        owner = users.create_user(session, email="c@x.test", display_name="C")
        library = libraries.create_library(session, owner.id, name="L")
        audio = create_audio(
            session,
            library_id=library.id,
            uploaded_by=owner.id,
            storage_path="placeholder",
            original_filename="long.wav",
        )
        source = make_audio(tmp_path / "long.wav", seconds=30.0)
        path, digest = storage.store_original(
            root, audio.uuid, [source.read_bytes()], filename="long.wav"
        )
        audio.storage_path = storage.relative(root, path)
        audio.sha256 = digest.sha256
        audio.size_bytes = digest.size_bytes
        audio.duration_ms = 30_000
        session.flush()
        audio_id = audio.id
    provider = CancellingProvider(database, after_parts=1)
    with database.write_session() as session:
        queue.enqueue(session, queue.KIND_TRANSCRIBE, audio_id=audio_id)

    worker = Worker(context_for(database, settings, provider))
    assert worker.run_once() is True

    # Two: the one that was already away when cancel arrived, and the one before it. Abandoning
    # the answer to a request that has been sent buys nothing back, so it is allowed to land.
    assert len(provider.submitted) == 2
    with database.read_session() as session:
        assert transcripts.active_transcript(session, audio_id) is None
