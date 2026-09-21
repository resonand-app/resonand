"""What the last connection test found, for as long as this instance is up (``BUG-3a``).

**Principle 2 forbids the instance reaching out on a read. It does not forbid it remembering that
somebody reached out.** ``GET /admin/transcription`` still contacts nobody; it now reports what the
last explicit check found and when, instead of reporting that nothing is known because it is not
allowed to go and find out. Those are different sentences, and only the second one was ever true.

**Held per application rather than per module**, for the reason ``Changes`` is: a test suite is two
instances in one process, and a module-level record would be one instance answering with another's
result.

**In memory rather than in the archive.** One process is the whole supported topology
(``deploy/README.md``), so there is nowhere for a second copy of this to disagree from. A restart
forgets it, which is the honest answer -- an instance that has just come up has not checked
anything -- and the alternative buys surviving a restart at the price of a migration and a green
verdict outliving the container that earned it.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass

from resonand.core.time import now_instant


@dataclass(frozen=True, slots=True)
class CheckOutcome:
    """One check, as it was answered.

    ``reachable`` is ``None`` where the check could not be run at all -- ffmpeg could not produce
    the sample, so nothing was contacted and nothing was sent. That is neither a pass nor a
    failure of the engine, and flattening it into one would report a provider as broken because
    this instance is.
    """

    reachable: bool | None
    usable: bool | None
    detail: str
    checked_at: str
    checked_by: str


class LastCheck:
    """The most recent outcome, or nothing if nobody has asked yet."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._outcome: CheckOutcome | None = None

    def record(
        self, *, reachable: bool | None, usable: bool | None, detail: str, by: str
    ) -> CheckOutcome:
        """Remember what a check just found, and return it stamped with the moment."""
        outcome = CheckOutcome(
            reachable=reachable,
            usable=usable,
            detail=detail,
            checked_at=now_instant(),
            checked_by=by,
        )
        with self._lock:
            self._outcome = outcome
        return outcome

    @property
    def outcome(self) -> CheckOutcome | None:
        with self._lock:
            return self._outcome
