"""Unique keys and display forms are kept apart (``DEC-15``, ``DEC-16``)."""

from __future__ import annotations

import pytest
from sonarium.core.text import clean_title, normalise_email, normalise_slug


@pytest.mark.parametrize(
    ("typed", "key"),
    [
        ("Gabriel@example.com", "gabriel@example.com"),
        ("  gabriel@example.com  ", "gabriel@example.com"),
        ("GABRIEL@EXAMPLE.COM", "gabriel@example.com"),
    ],
)
def test_two_casings_of_one_address_are_one_account(typed: str, key: str) -> None:
    assert normalise_email(typed) == key


def test_the_local_part_is_not_second_guessed() -> None:
    """Stripping dots or cutting at a plus is a guess about somebody else's mail server."""
    assert normalise_email("first.last+archive@example.com") == "first.last+archive@example.com"


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Fisica quantica", "fisica-quantica"),
        ("Fisica Quantica", "fisica-quantica"),
        ("  quantum   physics  ", "quantum-physics"),
        ("Long duration!", "long-duration"),
        ("C++", "c"),
        ("2024", "2024"),
    ],
)
def test_a_slug_is_lowercase_without_diacritics_and_hyphenated(name: str, slug: str) -> None:
    assert normalise_slug(name) == slug


def test_diacritics_collapse_onto_the_same_slug() -> None:
    """Somebody typing Fisica against an existing fisica must land on the existing tag."""
    assert normalise_slug("Física") == normalise_slug("fisica") == "fisica"


def test_a_non_latin_tag_keeps_its_own_letters() -> None:
    assert normalise_slug("μουσική") != ""


@pytest.mark.parametrize(
    ("filename", "title"),
    [
        ("Recording 2024-03-11 18.22.m4a", "Recording 2024-03-11 18.22"),
        ("PTT-20240311-WA0007.opus", "PTT-20240311-WA0007"),
        ("avia_fabrica.mp3", "avia fabrica"),
        ("no-extension", "no-extension"),
        (".hidden", ".hidden"),
    ],
)
def test_a_default_title_is_the_filename_lightly_cleaned(filename: str, title: str) -> None:
    assert clean_title(filename) == title
