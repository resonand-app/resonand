"""audio.recorded_at_precision

Revision ID: 0004_recorded_at_precision
Revises: 0003_transcript_facts
Create Date: 2026-09-20

A derived ``recorded_at`` is stored at a fixed width, so a source that stated only a day arrives
in the column as midnight (``ING-12``). The deriver has always known the difference and thrown it
away, which means a filename like ``PTT-20240311-WA0007.opus`` -- the shape this feature exists to
rescue -- is presented as a recording made at 00:00. This column keeps what the source actually
said: ``date``, ``minute`` or ``second``.

Existing rows are left as ``NULL``, as ``0002`` left its own column, and ``NULL`` means *unknown*
rather than *date-only*: re-deriving would mean re-reading files that may have moved, and reading
the absence as date-only would withdraw a real time from every row a container tag populated. An
unknown precision therefore renders exactly as it does today.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004_recorded_at_precision"
down_revision: str | None = "0003_transcript_facts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE audio ADD COLUMN recorded_at_precision TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE audio DROP COLUMN recorded_at_precision")
