"""Normalisation of the two values that pair a unique key with a human display form (``DEC-15``).

In both cases the key and the form shown to a person are kept apart. Email is unique on
``email_normalised`` and displayed from ``email``; a tag's ``slug`` is globally unique and the
first writer owns the ``name``. Collapsing the two would mean that somebody typing *Fisica*
silently renames *Fisica* for everybody, or that two casings of one address become two accounts.
"""

from __future__ import annotations

import re
import unicodedata

_NON_SLUG = re.compile(r"[^a-z0-9]+")


def normalise_email(email: str) -> str:
    """The unique key for an address: trimmed and lowercased, and nothing cleverer.

    Deliberately not doing provider-specific tricks (stripping dots, cutting at ``+``): those are
    guesses about somebody else's mail server, and getting one wrong merges two real accounts.
    """
    return email.strip().lower()


def normalise_slug(name: str) -> str:
    """The globally unique key for a tag name: lowercase, without diacritics, hyphen-separated.

    Characters outside the Latin alphabet survive transliteration-free: a Greek or Cyrillic tag
    keeps its own letters rather than collapsing to an empty slug.
    """
    decomposed = unicodedata.normalize("NFKD", name.strip().casefold())
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    recomposed = unicodedata.normalize("NFKC", without_marks)
    pieces = [
        piece
        for piece in re.split(r"[^\w]+", recomposed, flags=re.UNICODE)
        if piece and not piece.isspace()
    ]
    slug = "-".join(pieces).strip("-")
    return re.sub(r"-{2,}", "-", slug)


def clean_title(filename: str) -> str:
    """A recording's default title: the filename without its extension, lightly cleaned.

    Lightly is the operative word (``DEC-16``) -- separators become spaces and runs of whitespace
    collapse, but nothing is dropped or capitalised. The field is always editable, so guessing
    harder only produces titles the user has to undo.
    """
    stem = filename.rsplit("/", 1)[-1]
    if "." in stem[1:]:
        stem = stem.rsplit(".", 1)[0]
    spaced = re.sub(r"[_]+", " ", stem)
    collapsed = re.sub(r"\s{2,}", " ", spaced).strip(" -")
    return collapsed or stem or filename


def is_ascii_slug(value: str) -> bool:
    """Whether a slug only uses the reduced alphabet -- used by tests, not by the writers."""
    return _NON_SLUG.sub("", value) == value.replace("-", "")
