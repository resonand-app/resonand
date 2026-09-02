"""The accepted-format allowlist (``DEC-17``).

Video containers are accepted and **kept whole** -- principle 1 says the original is intact --
with audio-only Opus derived for playback, and are never presented as a video player. Refusing
video would be the wrong call: the file with your grandmother in it is quite often the mp4.
"""

from __future__ import annotations

AUDIO_EXTENSIONS: frozenset[str] = frozenset(
    {".m4a", ".mp3", ".opus", ".ogg", ".oga", ".wav", ".flac", ".aac", ".amr", ".3gp", ".wma"}
)

VIDEO_EXTENSIONS: frozenset[str] = frozenset({".mp4", ".m4v", ".mov"})

ACCEPTED_EXTENSIONS: frozenset[str] = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


def normalise_extension(filename: str) -> str:
    """The lowercased extension of a filename, dot included, or an empty string."""
    _, _, tail = filename.rpartition(".")
    return f".{tail.lower()}" if tail and tail != filename else ""


def is_accepted(filename: str) -> bool:
    """Whether a filename carries an extension the archive ingests."""
    return normalise_extension(filename) in ACCEPTED_EXTENSIONS


def is_video_container(filename: str) -> bool:
    """Whether the original is a video container whose audio has to be derived."""
    return normalise_extension(filename) in VIDEO_EXTENSIONS
