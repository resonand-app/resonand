"""Unique keys and display forms are kept apart (``DEC-15``, ``DEC-16``)."""

from __future__ import annotations

import pytest
from resonand.core.text import (
    TITLE_MAX_LENGTH,
    clean_title,
    normalise_email,
    normalise_slug,
    shorten,
)


@pytest.mark.parametrize(
    ("typed", "key"),
    [
        ("Alex@example.com", "alex@example.com"),
        ("  alex@example.com  ", "alex@example.com"),
        ("ALEX@EXAMPLE.COM", "alex@example.com"),
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
        ("voice_memo_02.mp3", "voice memo 02"),
        ("no-extension", "no-extension"),
        (".hidden", ".hidden"),
    ],
)
def test_a_default_title_is_the_filename_lightly_cleaned(filename: str, title: str) -> None:
    assert clean_title(filename) == title


# --- How long a name can be (DAT-12) ------------------------------------------


def test_a_name_inside_the_limit_is_left_alone() -> None:
    assert shorten("Field notes", 11) == "Field notes"


def test_a_long_name_is_cut_at_the_last_space_inside_the_limit() -> None:
    assert shorten("Field notes from the harbour", 16) == "Field notes from"
    assert shorten("Field notes from the harbour", 14) == "Field notes"


def test_a_cut_that_lands_on_a_space_keeps_the_whole_word_before_it() -> None:
    assert shorten("Field notes from", 11) == "Field notes"


def test_a_name_with_no_space_is_cut_at_the_limit() -> None:
    assert shorten("x" * 300, 200) == "x" * 200


def test_what_is_left_ends_on_a_word_rather_than_on_a_separator() -> None:
    assert shorten("Interview - part one", 14) == "Interview"


def test_no_ellipsis_is_added() -> None:
    assert not shorten("one two three four", 10).endswith(("...", "\u2026"))


def test_a_default_title_from_a_long_filename_fits_the_limit() -> None:
    stem = " ".join(f"word{index:03d}" for index in range(40))
    title = clean_title(f"{stem}.m4a")
    assert len(title) <= TITLE_MAX_LENGTH
    assert stem.startswith(title)
    assert stem[len(title)] == " ", "cut at a space, not inside a word"
