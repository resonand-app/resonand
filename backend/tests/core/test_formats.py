"""The accepted-format allowlist (``DEC-17``)."""

from __future__ import annotations

import pytest
from sonarium.core.formats import is_accepted, is_video_container, normalise_extension


@pytest.mark.parametrize("filename", ["note.m4a", "NOTE.M4A", "talk.opus", "song.flac"])
def test_audio_is_accepted(filename: str) -> None:
    assert is_accepted(filename)
    assert not is_video_container(filename)


@pytest.mark.parametrize("filename", ["grandmother.mp4", "village.MOV", "clip.m4v"])
def test_video_containers_are_accepted_and_flagged_as_such(filename: str) -> None:
    """The file with your grandmother in it is quite often the mp4."""
    assert is_accepted(filename)
    assert is_video_container(filename)


@pytest.mark.parametrize("filename", ["notes.pdf", "archive.zip", "no-extension", ""])
def test_everything_else_is_refused(filename: str) -> None:
    assert not is_accepted(filename)


def test_an_extension_normalises_to_lowercase_with_its_dot() -> None:
    assert normalise_extension("Recording.M4A") == ".m4a"
    assert normalise_extension("no-extension") == ""
