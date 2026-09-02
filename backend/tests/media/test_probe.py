"""Reading technical metadata, defensively (``ING-4``)."""

from __future__ import annotations

from pathlib import Path

import pytest
from sonarium.core.errors import InvalidRequestError
from sonarium.media.probe import parse_probe, probe

from tests.media.conftest import make_audio, make_video, needs_ffmpeg


def test_a_duration_only_on_the_container_is_still_found() -> None:
    """Real files put it on one, the other, or neither."""
    parsed = parse_probe(
        {
            "streams": [{"codec_type": "audio", "codec_name": "opus"}],
            "format": {"duration": "63.5", "format_name": "ogg"},
        }
    )
    assert parsed.duration_ms == 63_500


def test_a_duration_on_the_stream_is_preferred() -> None:
    parsed = parse_probe(
        {
            "streams": [{"codec_type": "audio", "duration": "10.0"}],
            "format": {"duration": "12.0"},
        }
    )
    assert parsed.duration_ms == 10_000


def test_an_audio_stream_that_is_not_first_is_still_found() -> None:
    """A video container puts the picture first, and it is the sound that matters."""
    parsed = parse_probe(
        {
            "streams": [
                {"codec_type": "video", "codec_name": "h264"},
                {"codec_type": "audio", "codec_name": "aac", "sample_rate": "48000"},
            ],
            "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2"},
        }
    )
    assert parsed.codec == "aac"
    assert parsed.sample_rate == 48_000
    assert parsed.has_video is True


def test_cover_art_is_not_a_video_track() -> None:
    """An mp3 with an embedded picture is not a video, and must not be treated as one."""
    parsed = parse_probe(
        {
            "streams": [
                {"codec_type": "video", "codec_name": "mjpeg", "disposition": {"attached_pic": 1}},
                {"codec_type": "audio", "codec_name": "mp3"},
            ],
            "format": {"format_name": "mp3"},
        }
    )
    assert parsed.has_video is False


def test_missing_fields_do_not_stop_the_parse() -> None:
    parsed = parse_probe({"streams": [{"codec_type": "audio"}], "format": {}})
    assert parsed.duration_ms is None
    assert parsed.codec is None
    assert parsed.sample_rate is None


@pytest.mark.parametrize("duration", ["N/A", "", None, "not a number"])
def test_an_unreadable_duration_is_absent_rather_than_wrong(duration: object) -> None:
    parsed = parse_probe({"streams": [{"codec_type": "audio", "duration": duration}], "format": {}})
    assert parsed.duration_ms is None


def test_a_file_with_no_sound_is_refused_with_a_reason() -> None:
    parsed = {"streams": [{"codec_type": "video"}], "format": {}}
    with pytest.raises(InvalidRequestError, match="no audio track"):
        parse_probe(parsed)


def test_container_tags_are_kept_for_the_recording_date_to_look_at() -> None:
    parsed = parse_probe(
        {
            "streams": [{"codec_type": "audio"}],
            "format": {"tags": {"creation_time": "2024-03-11T16:22:00.000000Z"}},
        }
    )
    assert parsed.format_tags["creation_time"].startswith("2024-03-11")


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_real_recording_reports_what_it_is(tmp_path: Path) -> None:
    parsed = probe(make_audio(tmp_path / "note.wav", seconds=2.0))
    assert 1_900 <= (parsed.duration_ms or 0) <= 2_100
    assert parsed.sample_rate
    assert parsed.size_bytes > 0
    assert parsed.has_video is False


@needs_ffmpeg
@pytest.mark.ffmpeg
def test_a_real_video_container_reports_its_audio_and_its_picture(tmp_path: Path) -> None:
    parsed = probe(make_video(tmp_path / "grandmother.mp4", seconds=2.0))
    assert parsed.has_video is True
    assert parsed.codec is not None
    assert parsed.mime == "audio/mp4"
