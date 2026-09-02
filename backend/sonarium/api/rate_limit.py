"""Slowing down repeated attempts (``INT-5``).

Scoped to the application object rather than to the module, which is what makes it correct as
well as testable: two instances in one process -- which is what a test suite is -- do not share a
counter, and the state cannot outlive the thing it belongs to.

Honest about what it is: an in-memory counter that resets when the container restarts. It exists
to make grinding through a password list slow. Rate limiting as a security boundary is the
reverse proxy's job, and saying so here is better than implying this is one.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict

WINDOW_SECONDS = 60.0


class AttemptLimiter:
    """Counts attempts per key over a sliding window."""

    def __init__(self, per_window: int, window_seconds: float = WINDOW_SECONDS) -> None:
        self._per_window = per_window
        self._window = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        """Record an attempt. False when this one is over the limit."""
        now = time.monotonic()
        with self._lock:
            recent = [at for at in self._attempts[key] if now - at < self._window]
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
