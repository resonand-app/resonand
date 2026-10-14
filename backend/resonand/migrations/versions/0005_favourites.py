"""favourite

Revision ID: 0005_favourites
Revises: 0004_recorded_at_precision
Create Date: 2026-10-14

A mark one account puts on a recording it can read (``DAT-11``). One row per account and
recording, private to the account that wrote it: nothing reads another account's rows, and nothing
counts them. Every read joins the ACL, so a row whose recording the account can no longer see is
kept and hidden rather than deleted, and comes back if the access does.

Both foreign keys cascade. Purging a recording or deleting an account is the only way a row goes
without its owner asking, and neither should leave one behind pointing at nothing.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0005_favourites"
down_revision: str | None = "0004_recorded_at_precision"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE favourite (
          user_id    INTEGER NOT NULL REFERENCES user(id)  ON DELETE CASCADE,
          audio_id   INTEGER NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
          created_at TEXT NOT NULL,
          PRIMARY KEY (user_id, audio_id)
        )
        """
    )
    # The primary key leads with the account, so the cascade from a purged recording needs its own.
    op.execute("CREATE INDEX ix_favourite_audio ON favourite(audio_id)")


def downgrade() -> None:
    op.execute("DROP TABLE favourite")
