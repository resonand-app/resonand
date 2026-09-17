"""Chunking a long recording and re-stitching its timestamps (``JOB-13``).

What these defend, in one sentence: **a click in the last hour of a three-hour recording seeks to
the right second.** If the per-part offsets were dropped, the transcript would still read
perfectly and every word would be present -- and nobody would report it, because a transcript that
is right and a transcript that is misplaced look identical on the page.
"""

from __future__ import annotations

from collections.abc import Sequence

import pytest
from sonarium.transcription.chunking import (
    DEFAULT_OVERLAP_MS,
    MIN_PART_MS,
    Part,
    Plan,
    Silence,
    max_part_ms_for,
    parse_silences,
    plan_parts,
    restitch,
    seams,
)
from sonarium.transcription.contract import TranscriptSegment

THREE_HOURS_MS = 3 * 60 * 60 * 1000
TEN_MINUTES_MS = 10 * 60 * 1000


def speech_every(interval_ms: int, *, until_ms: int) -> list[TranscriptSegment]:
    """A recording that says the time, once per interval, all the way through."""
    return [
        TranscriptSegment(start_ms=at, end_ms=at + 1_000, text=f"at {at}")
        for at in range(0, until_ms, interval_ms)
    ]


def transcribe(plan: Plan, truth: Sequence[TranscriptSegment]) -> list[list[TranscriptSegment]]:
    """A fake engine: it returns what is really in each part, timed from that part's start.

    This is exactly what a real provider does -- it has no idea where its part came from -- and it
    is the reason the offsets have to be applied by us.
    """
    per_part: list[list[TranscriptSegment]] = []
    for part in plan.parts:
        inside = [
            segment
            for segment in truth
            if segment.start_ms >= part.start_ms and segment.end_ms <= part.end_ms
        ]
        per_part.append([segment.shifted(-part.start_ms) for segment in inside])
    return per_part


# --- Planning -------------------------------------------------------------


def test_a_recording_under_the_ceiling_is_one_part_with_no_seams() -> None:
    plan = plan_parts(60_000, max_part_ms=TEN_MINUTES_MS)
    assert plan.is_single
    assert plan.parts[0].start_ms == 0
    assert plan.parts[0].duration_ms == 60_000
    assert seams(plan) == ()


def test_a_long_recording_is_covered_completely() -> None:
    """Every moment has to be inside some part, or speech is lost between two of them."""
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    assert plan.parts[0].start_ms == 0
    assert plan.parts[-1].end_ms == THREE_HOURS_MS
    for earlier, later in zip(plan.parts, plan.parts[1:], strict=False):
        assert later.start_ms < earlier.end_ms, "consecutive parts have to overlap"


def test_no_part_exceeds_the_ceiling() -> None:
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    assert all(part.duration_ms <= TEN_MINUTES_MS + DEFAULT_OVERLAP_MS for part in plan.parts)


def test_a_cut_lands_in_a_pause_when_there_is_one_nearby() -> None:
    """Cutting mid-word is what the overlap is there to survive; not needing to is better."""
    pause = Silence(start_ms=TEN_MINUTES_MS - 20_000, end_ms=TEN_MINUTES_MS - 18_000)
    plan = plan_parts(TEN_MINUTES_MS * 2, silences=[pause], max_part_ms=TEN_MINUTES_MS)
    assert plan.parts[1].start_ms == pause.middle_ms - DEFAULT_OVERLAP_MS


def test_continuous_speech_with_no_pause_at_all_still_gets_cut() -> None:
    """A planner that insisted on a pause would either never cut this or cut it absurdly."""
    plan = plan_parts(THREE_HOURS_MS, silences=[], max_part_ms=TEN_MINUTES_MS)
    assert len(plan.parts) > 1
    assert plan.parts[-1].end_ms == THREE_HOURS_MS


def test_a_pause_outside_the_window_is_not_used() -> None:
    far_away = Silence(start_ms=1_000, end_ms=2_000)
    plan = plan_parts(TEN_MINUTES_MS * 2, silences=[far_away], max_part_ms=TEN_MINUTES_MS)
    assert plan.parts[1].start_ms > far_away.end_ms


def test_the_byte_ceiling_becomes_a_duration() -> None:
    """The hosted path caps a request at 25 MB, and the parts are Opus at a known bitrate."""
    ceiling = max_part_ms_for(25 * 1024 * 1024)
    assert ceiling > 30 * 60 * 1000, "25 MB of speech Opus is well over half an hour"
    assert max_part_ms_for(1) == MIN_PART_MS, "an absurd ceiling still produces a usable part"


# --- Re-stitching ---------------------------------------------------------


def test_a_three_hour_recording_comes_back_as_one_continuous_transcript() -> None:
    """The mandatory test. Timestamps must line up at the *end* of the file, not only the start."""
    truth = speech_every(30_000, until_ms=THREE_HOURS_MS)
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    assert len(plan.parts) > 15, "this has to actually be split for the test to mean anything"

    stitched = restitch(plan, transcribe(plan, truth))

    assert [segment.text for segment in stitched] == [segment.text for segment in truth]
    for segment in stitched:
        spoken_at = int(segment.text.removeprefix("at "))
        assert segment.start_ms == spoken_at, "a click here would seek to the wrong second"


def test_the_last_hour_is_where_dropping_the_offsets_would_show() -> None:
    truth = speech_every(60_000, until_ms=THREE_HOURS_MS)
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    stitched = restitch(plan, transcribe(plan, truth))
    final = stitched[-1]
    assert final.start_ms > 2 * 60 * 60 * 1000
    assert final.start_ms == int(final.text.removeprefix("at "))


def test_a_word_in_the_overlap_survives_exactly_once() -> None:
    """A speaker really can say the same short phrase twice, so this cannot be a text comparison."""
    plan = plan_parts(TEN_MINUTES_MS * 2, max_part_ms=TEN_MINUTES_MS)
    seam = seams(plan)[0]
    overlapping = TranscriptSegment(start_ms=seam - 500, end_ms=seam + 500, text="right on the cut")
    stitched = restitch(plan, transcribe(plan, [overlapping]))
    assert [segment.text for segment in stitched].count("right on the cut") == 1


def test_a_transcript_assembled_from_parts_carries_no_speaker_labels() -> None:
    """``TRX-13``: an engine names the voices it hears in one request, and nothing else.

    A diarising engine asked for four parts returns four independent guesses, each starting again
    at ``SPEAKER_00``. Carrying them through would say that the person speaking at three hours is
    the person who spoke at the start, which is a claim nobody made and which reads exactly like a
    correct transcript.
    """
    diarised = [
        TranscriptSegment(start_ms=at, end_ms=at + 1_000, text=f"at {at}", speaker="SPEAKER_00")
        for at in range(0, THREE_HOURS_MS, 60_000)
    ]
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    assert not plan.is_single
    stitched = restitch(plan, transcribe(plan, diarised))
    assert stitched, "the speech is still there"
    assert all(segment.speaker is None for segment in stitched)
    assert [segment.text for segment in stitched] == [segment.text for segment in diarised]


def test_a_recording_sent_whole_keeps_the_labels_it_came_back_with() -> None:
    """The other half of the rule: nothing is dropped where nothing had to be merged."""
    diarised = [
        TranscriptSegment(start_ms=0, end_ms=1_000, text="hello", speaker="SPEAKER_00"),
        TranscriptSegment(start_ms=1_000, end_ms=2_000, text="hello back", speaker="SPEAKER_01"),
    ]
    plan = plan_parts(60_000, max_part_ms=TEN_MINUTES_MS)
    assert plan.is_single
    stitched = restitch(plan, transcribe(plan, diarised))
    assert [segment.speaker for segment in stitched] == ["SPEAKER_00", "SPEAKER_01"]


def test_the_same_phrase_said_twice_is_kept_twice() -> None:
    said_twice = [
        TranscriptSegment(start_ms=100_000, end_ms=101_000, text="that is right"),
        TranscriptSegment(start_ms=700_000, end_ms=701_000, text="that is right"),
    ]
    plan = plan_parts(TEN_MINUTES_MS * 2, max_part_ms=TEN_MINUTES_MS)
    stitched = restitch(plan, transcribe(plan, said_twice))
    assert len(stitched) == 2


def test_a_single_part_is_returned_untouched() -> None:
    truth = speech_every(10_000, until_ms=120_000)
    plan = plan_parts(120_000, max_part_ms=TEN_MINUTES_MS)
    stitched = restitch(plan, transcribe(plan, truth))
    assert stitched == tuple(truth)


def test_the_output_is_in_playback_order() -> None:
    truth = speech_every(45_000, until_ms=THREE_HOURS_MS)
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    stitched = restitch(plan, transcribe(plan, truth))
    assert list(stitched) == sorted(stitched, key=lambda s: s.start_ms)


def test_results_that_do_not_match_the_plan_are_refused() -> None:
    """Stitching a mismatched set would silently misplace speech, which is the failure mode."""
    plan = plan_parts(THREE_HOURS_MS, max_part_ms=TEN_MINUTES_MS)
    with pytest.raises(ValueError, match="out of step"):
        restitch(plan, [[]])


def test_an_empty_part_contributes_nothing_and_breaks_nothing() -> None:
    """A part that was all silence really does come back with no segments."""
    plan = plan_parts(TEN_MINUTES_MS * 3, max_part_ms=TEN_MINUTES_MS)
    results: list[list[TranscriptSegment]] = [[] for _ in plan.parts]
    results[0] = [TranscriptSegment(0, 1_000, "only at the start")]
    stitched = restitch(plan, results)
    assert [segment.text for segment in stitched] == ["only at the start"]


# --- Silence detection ----------------------------------------------------


def test_ffmpeg_silence_output_is_parsed_out_of_its_chatter() -> None:
    output = """
    [silencedetect @ 0x5] silence_start: 12.345
    frame= 100 fps=0.0 q=-0.0 size=N/A time=00:00:12.00 bitrate=N/A speed=1x
    [silencedetect @ 0x5] silence_end: 13.5 | silence_duration: 1.155
    [silencedetect @ 0x5] silence_start: 30
    [silencedetect @ 0x5] silence_end: 31.25 | silence_duration: 1.25
    """
    found = parse_silences(output)
    assert found == (Silence(12_345, 13_500), Silence(30_000, 31_250))


def test_a_silence_that_never_ends_is_not_half_reported() -> None:
    """ffmpeg omits the final silence_end when the file ends in silence."""
    assert parse_silences("[silencedetect] silence_start: 10.0") == ()


def test_no_silence_at_all_parses_to_nothing() -> None:
    assert parse_silences("frame= 1 fps=0.0\n") == ()


def test_a_part_knows_where_it_ends() -> None:
    assert Part(index=0, start_ms=1_000, duration_ms=500).end_ms == 1_500
