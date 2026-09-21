"""Slowing down repeated attempts (``INT-5``, ``SEC-3``).

Scoped to the application object rather than to the module, which is what makes it correct as
well as testable: two instances in one process -- which is what a test suite is -- do not share a
counter, and the state cannot outlive the thing it belongs to.

Honest about what it is: an in-memory counter that resets when the container restarts. It exists
to make grinding through a password list slow. Rate limiting as a security boundary is the
reverse proxy's job, and saying so here is better than implying this is one.

**What a key is made of is the whole design** (``SEC-3``). Counting per address alone was wrong in
both directions at once. It throttled nothing, because one client could try sixty addresses a
minute and never reach a limit; and it was a weapon, because anybody who knew an address could
spend that address's budget from anywhere and lock its owner out of their own account for as long
as they cared to keep going. So there are two counters and neither is the address on its own:

* **address and client together** -- guessing one account's password from one place, where
  somebody else's failures elsewhere cannot exhaust the budget;
* **client alone**, at a higher ceiling -- trying many accounts from one place.

Spraying many accounts from many addresses is deliberately not covered. That needs state this
process does not keep and a view of the network it cannot see, which is the proxy's job again.
"""

from __future__ import annotations

import threading
import time

WINDOW_SECONDS = 60.0

SWEEP_AT_KEYS = 4096
"""How many tracked keys are tolerated before the expired ones are dropped.

The counter is reachable without a session, so a dictionary that only grew was a slow leak anybody
could drive: every address ever tried stayed resident until the process restarted. Sweeping on a
threshold rather than on a timer keeps the cost on whoever is causing it, and an instance nobody
is attacking never reaches it.
"""


def address_key(email: str, client: str | None) -> str:
    """The counter for one account being guessed at from one place.

    ``client`` is whatever uvicorn resolved, which behind a proxy means ``X-Forwarded-For`` and is
    therefore only as trustworthy as ``--forwarded-allow-ips``. A missing one shares a bucket with
    every other missing one, which is the safe direction: unknown clients throttle each other
    rather than each getting a budget of their own.
    """
    return f"address:{email}|{client or 'unknown'}"


def client_key(client: str | None) -> str:
    """The counter for one place trying many accounts."""
    return f"client:{client or 'unknown'}"


class AttemptLimiter:
    """Counts attempts per key over a sliding window."""

    def __init__(self, per_window: int, window_seconds: float = WINDOW_SECONDS) -> None:
        self._per_window = per_window
        self._window = window_seconds
        self._attempts: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        """Record an attempt. False when this one is over the limit."""
        now = time.monotonic()
        with self._lock:
            if len(self._attempts) >= SWEEP_AT_KEYS:
                self._sweep(now)
            recent = [at for at in self._attempts.get(key, ()) if now - at < self._window]
            self._attempts[key] = recent
            if len(recent) >= self._per_window:
                return False
            recent.append(now)
            return True

    def forget(self, key: str) -> None:
        """Clear a key's history. Called after a successful sign-in, so somebody who mistyped
        their password twice and then got it right is not still being counted."""
        with self._lock:
            self._attempts.pop(key, None)

    def tracked(self) -> int:
        """How many keys are being remembered. For the test that says this stays bounded."""
        with self._lock:
            return len(self._attempts)

    def _sweep(self, now: float) -> None:
        """Drop every key whose attempts have all aged out. Called with the lock held."""
        self._attempts = {
            key: attempts
            for key, attempts in self._attempts.items()
            if any(now - at < self._window for at in attempts)
        }
