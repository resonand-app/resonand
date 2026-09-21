"""audio.recorded_at_source

Revision ID: 0002_recorded_at_source
Revises: 0001_initial
Create Date: 2026-09-11

``recorded_at`` was always derived from the container's own tags, the filename or the file's
mtime (``ING-12``), but only the wall clock and its offset were kept -- which source won was
computed and then thrown away. The panel was left unable to tell "recorded" from "uploaded" apart
from whether ``recorded_at`` is ``NULL``, so a correctly derived date rendered with the same
caption as a missing one. This column keeps the source that was already known at ingestion time.

Existing rows are left as ``NULL`` on purpose: backfilling would mean re-deriving a source for
audio already ingested, which is exactly the re-detection this migration does not do.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0002_recorded_at_source"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE audio ADD COLUMN recorded_at_source TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE audio DROP COLUMN recorded_at_source")
