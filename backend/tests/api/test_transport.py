"""Which connection the browser was on, when a proxy is in the way (``API-24``).

The deployment this repository ships puts the proxy on the host, reaching the container on
loopback, where uvicorn resolves the scheme itself. The deployment a homelab builds puts it in a
second container, arriving from a bridge network -- outside ``--forwarded-allow-ips`` and so
ignored. These are the cases in between.
"""

from __future__ import annotations

import pytest
from resonand.api.transport import is_local_peer, scheme_behind

DOCKER_BRIDGE = "172.18.0.4"
LAN = "192.168.1.20"
LOOPBACK = "127.0.0.1"
INTERNET = "203.0.113.9"


@pytest.mark.parametrize(
    ("host", "local"),
    [
        (LOOPBACK, True),
        ("::1", True),
        (DOCKER_BRIDGE, True),
        (LAN, True),
        ("10.4.0.9", True),
        ("169.254.1.1", True),
        ("fd00::1", True),
        (INTERNET, False),
        ("8.8.8.8", False),
        # A name is not an address, and has not been shown to be anywhere.
        ("proxy", False),
        ("testclient", False),
        (None, False),
    ],
)
def test_which_peers_are_local(host: str | None, local: bool) -> None:
    assert is_local_peer(host) is local


def test_a_proxy_in_a_docker_network_is_believed_about_the_scheme() -> None:
    """The case that made this module: uvicorn ignored the header, so the request read as HTTP.

    Left alone, an instance properly behind TLS would have handed out an unmarked session cookie.
    """
    assert scheme_behind("http", DOCKER_BRIDGE, "https") == "https"


def test_a_proxy_uvicorn_already_trusted_is_taken_at_its_word() -> None:
    """Nothing is re-read once the scheme is resolved; uvicorn only ever raises it."""
    assert scheme_behind("https", LOOPBACK, None) == "https"
    assert scheme_behind("https", INTERNET, "http") == "https"


def test_a_client_off_the_internet_is_not_believed() -> None:
    """Otherwise the header is an open invitation rather than a proxy's statement."""
    assert scheme_behind("http", INTERNET, "https") == "http"


def test_a_chain_is_read_from_the_browser_end() -> None:
    """Each hop appends its own, so the browser's scheme is the leftmost value."""
    assert scheme_behind("http", DOCKER_BRIDGE, "https, http") == "https"
    assert scheme_behind("http", DOCKER_BRIDGE, "http, https") == "http"


@pytest.mark.parametrize("claimed", ["", "ftp", "HTTPS!", "  "])
def test_a_scheme_nobody_recognises_changes_nothing(claimed: str) -> None:
    assert scheme_behind("http", DOCKER_BRIDGE, claimed) == "http"


def test_the_header_is_read_whatever_case_it_was_written_in() -> None:
    assert scheme_behind("http", DOCKER_BRIDGE, "HTTPS") == "https"
    assert scheme_behind("http", DOCKER_BRIDGE, " https ") == "https"


def test_no_header_leaves_the_connection_speaking_for_itself() -> None:
    assert scheme_behind("http", DOCKER_BRIDGE, None) == "http"
    assert scheme_behind("http", LOOPBACK, None) == "http"


def test_a_local_peer_may_only_move_its_own_answer() -> None:
    """Forging the header costs the forger their own sign-in and nobody else anything.

    A browser on HTTPS never sends ``X-Forwarded-Proto``, so this cannot be aimed at one -- which
    is the whole reason the scheme is read from a wider set of peers than the address is.
    """
    assert scheme_behind("http", LAN, "https") == "https"
    assert scheme_behind("http", LAN, "http") == "http"
