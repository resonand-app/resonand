"""``sonarium fsck`` (``ING-13``).

**Principle 5 made checkable.** The stated worst outcome for this project is shipping something
that loses files, and nothing else in the plan would notice if it did: ``sha256`` is written once
at ingestion and, without this, never looked at again. A backup that has been silently restoring
truncated files for six months is exactly the failure this exists to catch.

Read-only. It reports and exits non-zero; repairing is a separate, explicit command, because a
tool that fixes things while it is looking at them is a tool nobody dares run on a Sunday.

Three findings, and the third is the one people forget:

* a row whose file is **missing** -- the archive thinks it has a recording it does not,
* a file whose contents have **changed** since ingestion -- bit rot, a bad restore, a half-copy,
* a file that **no row points at** -- an interrupted upload, or a deletion that got half done.
  Those are not dangerous, but they are how a disk fills up with nothing anybody can find.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from sonarium.db.models import Audio
from sonarium.media import storage
from sonarium.media.hashing import hash_file

MISSING = "missing"
CHANGED = "changed"
ORPHAN = "orphan"
UNHASHED = "unhashed"


@dataclass(frozen=True, slots=True)
class Finding:
    """One thing that is not as the archive says it is."""

    kind: str
    detail: str
    uuid: str | None = None


@dataclass(slots=True)
class Report:
    """What one run found."""

    checked: int = 0
    bytes_read: int = 0
    findings: list[Finding] = field(default_factory=list)

    @property
    def is_clean(self) -> bool:
        return not self.findings

    def summary(self) -> str:
        if self.is_clean:
            return f"{self.checked} recordings checked, all present and unchanged."
        counts: dict[str, int] = {}
        for finding in self.findings:
            counts[finding.kind] = counts.get(finding.kind, 0) + 1
        parts = ", ".join(f"{count} {kind}" for kind, count in sorted(counts.items()))
        return f"{self.checked} recordings checked, {len(self.findings)} problems: {parts}."


def check(session: Session, storage_root: Path, *, verify_hashes: bool = True) -> Report:
    """Walk the archive and compare it against the database.

    Trashed recordings are checked too. They are still the user's files until the retention period
    takes them, and a restore that produces a missing file is worse than one that never happened.
    """
    report = Report()
    seen: set[Path] = set()

    for audio in session.execute(select(Audio).order_by(Audio.id)).scalars().all():
        report.checked += 1
        path = storage.resolve(storage_root, audio.storage_path)
        seen.add(path)
        if not path.exists():
            report.findings.append(
                Finding(MISSING, f"{audio.title!r}: no file at {audio.storage_path}", audio.uuid)
            )
            continue
        if audio.sha256 is None:
            report.findings.append(
                Finding(UNHASHED, f"{audio.title!r} was stored without a hash", audio.uuid)
            )
            continue
        if not verify_hashes:
            continue
        digest = hash_file(path)
        report.bytes_read += digest.size_bytes
        if digest.sha256 != audio.sha256:
            report.findings.append(
                Finding(
                    CHANGED,
                    f"{audio.title!r}: the file has changed since it was ingested "
                    f"(expected {audio.sha256[:12]}, found {digest.sha256[:12]})",
                    audio.uuid,
                )
            )

    for path in storage.stored_files(storage_root):
        if path not in seen:
            report.findings.append(
                Finding(ORPHAN, f"no recording points at {storage.relative(storage_root, path)}")
            )

    return report
