"""Filtering by the four transcription states (``JOB-11b``).

The states are derived, not stored, and they are derived twice: once per recording for the badge
(:func:`sonarium.api.presenters.transcription_state`) and once in SQL for a whole query
(:func:`sonarium.db.search.apply_filters`). The load-bearing test here is that those two agree,
because if they do not, a card carries one badge and the toggle meant to select it does not find
it -- which is exactly the vocabulary split ``UI-8c`` exists to prevent.
"""

from __future__ import annotations

import pytest
from sonarium.acl.query import audio_select
from sonarium.api.presenters import transcription_state
from sonarium.core.states import TranscriptionState
from sonarium.db import libraries, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.engine import Database
from sonarium.db.search import Filters, apply_filters
from sonarium.db.transcripts import SegmentDraft
from sonarium.jobs import queue


@pytest.fixture
def four_states(database: Database) -> dict[str, int]:
    """One recording in each of the four states, plus the owner who can see them all.

    The awkward one is ``done_after_failing``: a transcript that arrived after a failed job. It is
    ``done``, because a recording that has a transcript is not in a failed state whatever happened
    on the way there -- and it is the case a naive "has a failed job" predicate gets wrong.
    """
    with database.write_session() as session:
        owner = users.create_user(session, email="o@x.test", display_name="O")
        library = libraries.create_library(session, owner.id, name="Family")

        made: dict[str, int] = {}
        for name in ("untouched", "queued", "running", "failed", "done", "done_after_failing"):
            audio = create_audio(
                session,
                library_id=library.id,
                uploaded_by=owner.id,
                storage_path=f"storage/aa/{name}/original.m4a",
                original_filename=f"{name}.m4a",
                title=name,
            )
            session.flush()
            made[name] = audio.id

        # One at a time, because ``claim`` takes the oldest pending job rather than a named one.
        # ``queued`` is enqueued last so that it is the only job left in ``pending``.
        def claim_for(name: str) -> int:
            queue.enqueue_transcription(session, audio_id=made[name], audio_uuid=name)
            work = queue.claim(session)
            assert work is not None and work.audio_id == made[name]
            return work.id

        claim_for("running")

        queue.fail(
            session, claim_for("failed"), "the provider refused", attempts=queue.MAX_ATTEMPTS
        )
        queue.fail(
            session,
            claim_for("done_after_failing"),
            "and then it failed",
            attempts=queue.MAX_ATTEMPTS,
        )
        for name in ("done", "done_after_failing"):
            transcripts.create_transcript(
                session, made[name], [SegmentDraft(0, 1_000, "something was said")]
            )

        queue.enqueue_transcription(session, audio_id=made["queued"], audio_uuid="queued")

        session.flush()
        return {"owner": owner.id, **made}


def _matching(database: Database, owner_id: int, *states: TranscriptionState) -> set[int]:
    with database.read_session() as session:
        query = apply_filters(audio_select(owner_id), Filters(transcription_states=states))
        return {row[0].id for row in session.execute(query).all()}


@pytest.mark.parametrize(
    ("state", "expected"),
    [
        (TranscriptionState.NONE, {"untouched"}),
        (TranscriptionState.RUNNING, {"queued", "running"}),
        (TranscriptionState.FAILED, {"failed"}),
        (TranscriptionState.DONE, {"done", "done_after_failing"}),
    ],
)
def test_each_state_selects_the_recordings_in_it(
    database: Database, four_states: dict[str, int], state: TranscriptionState, expected: set[str]
) -> None:
    assert _matching(database, four_states["owner"], state) == {
        four_states[name] for name in expected
    }


def test_the_filter_and_the_badge_always_agree(
    database: Database, four_states: dict[str, int]
) -> None:
    """The property the two implementations exist under.

    For every recording, the state the filter puts it in is the state the badge shows. Asserted
    over the whole set rather than case by case, so a fifth state or a change of precedence has
    to be made in both places or this fails.
    """
    owner_id = four_states["owner"]
    audio_ids = {value for key, value in four_states.items() if key != "owner"}
    with database.read_session() as session:
        by_badge = {audio_id: transcription_state(session, audio_id) for audio_id in audio_ids}
    for state in TranscriptionState:
        assert _matching(database, owner_id, state) == {
            audio_id for audio_id, badge in by_badge.items() if badge == state
        }, f"the {state} filter disagrees with the {state} badge"


def test_two_states_mean_either_rather_than_the_second(
    database: Database, four_states: dict[str, int]
) -> None:
    """Four independent toggles, so two ticked is a union.

    The old parameter took a single value, which meant a second toggle silently replaced the
    first -- the interface would have shown two ticked and filtered by one.
    """
    owner_id = four_states["owner"]
    both = _matching(database, owner_id, TranscriptionState.FAILED, TranscriptionState.DONE)
    assert both == {four_states[name] for name in ("failed", "done", "done_after_failing")}


def test_all_four_together_are_every_recording(
    database: Database, four_states: dict[str, int]
) -> None:
    """The four states partition the archive: every recording is in exactly one."""
    owner_id = four_states["owner"]
    everything = _matching(database, owner_id, *TranscriptionState)
    assert everything == {value for key, value in four_states.items() if key != "owner"}
    assert sum(len(_matching(database, owner_id, state)) for state in TranscriptionState) == len(
        everything
    ), "a recording was counted in two states"


def test_no_state_filter_leaves_everything_alone(
    database: Database, four_states: dict[str, int]
) -> None:
    """Empty is not the same as all four ticked only in that it costs nothing."""
    owner_id = four_states["owner"]
    assert _matching(database, owner_id) == {
        value for key, value in four_states.items() if key != "owner"
    }
