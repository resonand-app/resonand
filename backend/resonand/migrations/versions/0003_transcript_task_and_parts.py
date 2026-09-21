"""transcript.task and transcript.stitched_from

Revision ID: 0003_transcript_facts
Revises: 0002_recorded_at_source
Create Date: 2026-09-17

A transcript recorded where it came from -- provider, model, language -- and nothing about what it
is. Two facts cannot be derived from its segments afterwards (``TRX-12``).

``task`` separates a transcript in the recording's own language from a translation into another
one. Existing rows are backfilled to ``transcribe`` because nothing has ever produced anything
else, and that is exactly what makes the backfill safe.

``stitched_from`` is the number of parts the audio was submitted in, and is what says whether a
transcript's speaker labels can be trusted: labels are per request, so ``SPEAKER_00`` in part one
is not ``SPEAKER_00`` in part four. Existing rows are left ``NULL`` -- the part count was never
recorded and cannot be recomputed, since it depended on the ceiling in force at the time.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0003_transcript_facts"
down_revision: str | None = "0002_recorded_at_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE transcript ADD COLUMN task TEXT NOT NULL DEFAULT 'transcribe'")
    op.execute("ALTER TABLE transcript ADD COLUMN stitched_from INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE transcript DROP COLUMN stitched_from")
    op.execute("ALTER TABLE transcript DROP COLUMN task")
