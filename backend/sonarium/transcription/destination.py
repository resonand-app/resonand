"""Where audio goes, described narrowly enough to show anybody (``API-12``).

The administration view already reports the provider in full, but it is administrator-only, so
until now **a non-administrator could not be told where their own audio was going**. That makes
principle 2 -- nothing leaves the instance without saying so first -- a sentence in a document
rather than a property of the software, for exactly the people it exists to protect.

What is derived here is the *minimum* the disclosure needs: which provider, which host, whether
that host is on the instance's own network, and whether one is configured at all. No credential,
no flag about one, no base URL, since a base URL can carry auth in its userinfo.

**``is_local`` is deliberately pessimistic.** It says *true* only for hosts that cannot be
anywhere else -- loopback, the private ranges, the local-network suffixes, and a bare dotless
name, which on a container network is a service on the same machine. Everything it cannot place,
including anything it fails to parse, is *false*. The two mistakes are not symmetrical: a wrong
*true* tells somebody their recording stays home when it does not, which is the failure this
endpoint exists to prevent, while a wrong *false* only makes the notice more factual than it
needed to be.
"""

from __future__ import annotations

import ipaddress
from urllib.parse import urlsplit

LOCAL_SUFFIXES = (".local", ".internal", ".localdomain", ".home.arpa")
"""Names that resolve only on the network asking. ``.local`` is mDNS and the rest are the
conventional private suffixes."""

LOCAL_NAMES = ("localhost",)


def destination_host(base_url: str | None) -> str | None:
    """The host and port a provider is reached at, or ``None`` when none is configured.

    Userinfo is dropped rather than passed through: a base URL is allowed to carry credentials
    and this string is shown to every caller.
    """
    if not base_url:
        return None
    try:
        parts = urlsplit(base_url)
    except ValueError:
        return None
    if not parts.hostname:
        return None
    return f"{parts.hostname}:{parts.port}" if parts.port else parts.hostname


def is_local(base_url: str | None) -> bool:
    """Whether the provider is on the instance's own network, as far as can be told."""
    if not base_url:
        return False
    try:
        hostname = urlsplit(base_url).hostname
    except ValueError:
        return False
    if not hostname:
        return False
    name = hostname.strip("[]").rstrip(".").lower()
    if name in LOCAL_NAMES or name.endswith(LOCAL_SUFFIXES):
        return True
    try:
        address = ipaddress.ip_address(name)
    except ValueError:
        # Not an address, so it is a name: a dotless one is a container or a LAN hostname,
        # and anything with a dot is a domain that resolves from outside as well.
        return "." not in name
    # ``is_private`` is the IANA special-purpose set, so it is wider than RFC 1918: it also
    # covers the documentation and benchmarking ranges. Those never appear in a deployment,
    # and enumerating the ranges by hand would be more code with more to get wrong.
    return bool(address.is_loopback or address.is_private or address.is_link_local)
