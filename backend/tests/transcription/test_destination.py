"""Placing the transcription provider (``API-12``).

The whole point of ``is_local`` is which register ``UI-25``'s notice speaks in, so the property
under test is not "does it get it right" but "which way does it get it wrong": a host it cannot
place must come back as *not* local.
"""

from __future__ import annotations

import pytest
from resonand.transcription.destination import destination_host, is_local


@pytest.mark.parametrize(
    ("base_url", "expected"),
    [
        ("http://whisper:8000/v1", "whisper:8000"),
        ("http://localhost/v1", "localhost"),
        ("https://api.openai.com/v1", "api.openai.com"),
        ("http://[::1]:9000/v1", "::1:9000"),
        (None, None),
        ("", None),
        ("not a url at all", None),
    ],
)
def test_the_host_is_reported_as_somebody_would_recognise_it(
    base_url: str | None, expected: str | None
) -> None:
    assert destination_host(base_url) == expected


def test_the_credential_in_a_base_url_is_not_part_of_the_host() -> None:
    """A base URL is allowed to carry userinfo, and this string is shown to every caller."""
    host = destination_host("https://someone:hunter2@whisper.example.com/v1")
    assert host == "whisper.example.com"
    assert "hunter2" not in (host or "")


@pytest.mark.parametrize(
    "base_url",
    [
        "http://localhost:9000/v1",
        "http://127.0.0.1:9000/v1",
        "http://[::1]:9000/v1",
        "http://whisper:8000/v1",
        "http://whisper.local:9000/v1",
        "http://nas.home.arpa/v1",
        "http://192.168.1.20:9000/v1",
        "http://10.0.0.4/v1",
        "http://172.16.5.5/v1",
    ],
)
def test_a_host_that_cannot_be_anywhere_else_is_local(base_url: str) -> None:
    assert is_local(base_url) is True


@pytest.mark.parametrize(
    "base_url",
    [
        "https://api.openai.com/v1",
        "https://whisper.example.com/v1",
        "http://8.8.8.8/v1",
        "http://93.184.216.34:9000/v1",
    ],
)
def test_a_host_that_resolves_from_outside_is_not_local(base_url: str) -> None:
    assert is_local(base_url) is False


@pytest.mark.parametrize("base_url", [None, "", "not a url at all", "http:///v1"])
def test_anything_unplaceable_is_reported_as_not_local(base_url: str | None) -> None:
    """The two mistakes are not symmetrical.

    A wrong *local* tells somebody their recording stays home when it does not, which is the
    failure this exists to prevent. A wrong *not local* only makes the notice more factual than
    it needed to be, so that is the way to be wrong.
    """
    assert is_local(base_url) is False
