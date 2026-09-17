"""What the browser's connection was, as opposed to what reached this process (``API-24``).

The session cookie is marked ``Secure`` for a browser on HTTPS and not for one on plain HTTP, and
getting that backwards is silent in both directions: a marked cookie on a plain connection is
discarded without a word, and the person is returned to the sign-in screen as though their password
were wrong. So the question "was the browser on HTTPS" has to be answered well.

uvicorn answers it already, from ``X-Forwarded-Proto``, for a peer inside ``--forwarded-allow-ips``
-- which defaults to ``127.0.0.1``. That is right for the deployment this project ships, where the
proxy is on the host and reaches the container on loopback. It is wrong for the one homelabs
actually build, where the proxy is a second container and arrives from a bridge network at
``172.16.0.0/12``: the header is ignored, every HTTPS request looks like plain HTTP, and the cookie
goes out unmarked on a deployment that deserved better.

**The trust is widened here for the scheme alone, and deliberately not for the address.** They are
different questions with opposite failure modes, and uvicorn's one flag governs both:

* Forging ``X-Forwarded-Proto`` can only make somebody's own cookie *more* marked than the channel
  deserved, which costs them their own sign-in and nobody else anything. A browser on HTTPS never
  sends the header, so it cannot be used against one.
* Forging ``X-Forwarded-For`` moves the address the sign-in limiter counts against (``SEC-3``).
  Trusting it from a whole private network would let anything on the LAN rotate the header and walk
  through both counters, which is the protection those two keys exist to provide.

So ``--forwarded-allow-ips`` stays narrow and this reads the one header where being wrong is cheap.
Immich resolves the same problem by trusting ``loopback``, ``linklocal`` and ``uniquelocal`` for
every forwarded header at once; it has no address-keyed login throttle to lose by it.
"""

from __future__ import annotations

import ipaddress
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import Request

FORWARDED_PROTO = "x-forwarded-proto"

SCHEMES = frozenset({"http", "https"})

LOCAL_NETWORKS = tuple(
    ipaddress.ip_network(cidr)
    for cidr in (
        # Loopback: the proxy on the host, which is the deployment this repository ships.
        "127.0.0.0/8",
        "::1/128",
        # Link-local.
        "169.254.0.0/16",
        "fe80::/10",
        # Private: a bridge network between containers, or the LAN a homelab sits on.
        "10.0.0.0/8",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "fc00::/7",
    )
)
"""The addresses a proxy in front of this instance can plausibly be speaking from.

Named rather than taken from :attr:`ipaddress.IPv4Address.is_private`, which is a wider idea than
this one: it counts the documentation ranges and every other block IANA has marked unreachable, and
a set this is read against should say what is in it. It is the same set Express calls ``loopback``,
``linklocal`` and ``uniquelocal``, which is what Immich trusts.
"""


def is_local_peer(host: str | None) -> bool:
    """Whether the request arrived from an address only something on this network can hold.

    A name rather than an address is not one: a peer resolved to ``testclient`` or to a container
    name has not been shown to be local, and guessing in the permissive direction is how a header
    from the internet gets believed.
    """
    if not host:
        return False
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(address in network for network in LOCAL_NETWORKS)


def scheme_behind(scheme: str, peer: str | None, forwarded_proto: str | None) -> str:
    """The scheme the browser used, given what the connection and the headers say.

    ``scheme`` is already the answer whenever uvicorn was able to give one -- it only ever raises
    it to ``https``, and never lowers it -- so a resolved HTTPS request is taken at its word and
    nothing else is read. The header is consulted only for a local peer that uvicorn did not trust,
    and only its first value: a chain writes the browser's own scheme leftmost and each hop's
    afterwards.
    """
    if scheme == "https":
        return scheme
    if forwarded_proto is None or not is_local_peer(peer):
        return scheme
    claimed = forwarded_proto.split(",")[0].strip().lower()
    return claimed if claimed in SCHEMES else scheme


def scheme_of(request: Request) -> str:
    """The scheme the browser used, read off a request."""
    return scheme_behind(
        request.url.scheme,
        request.client.host if request.client else None,
        request.headers.get(FORWARDED_PROTO),
    )


__all__ = ["FORWARDED_PROTO", "LOCAL_NETWORKS", "is_local_peer", "scheme_behind", "scheme_of"]
