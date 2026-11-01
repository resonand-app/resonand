"""name limits

Revision ID: 0006_name_limits
Revises: 0005_favourites
Create Date: 2026-11-01

Shortens every recording title over 200 characters and every library name over 100 (``DAT-12``),
so that an archive upgraded from ``0.1.0`` holds nothing the API would now refuse to save back
unchanged. Titles were never capped on upload, so a long filename is all it takes to have one.

The rule is the one the upload and the import apply from now on: cut at the last space inside the
limit, strip, no ellipsis. Recordings in the trash are included, because they can be restored. The
whole filename stays in ``original_filename``, which is why nothing here is lost.

``audio_fts`` is written by ``resonand.db.search_index`` alone rather than by triggers, so a
shortened title has its index row rewritten here as well, or a search would go on finding words
the title no longer has. A trashed recording is not indexed and stays that way.

There is no downgrade: what was cut off is not stored anywhere a migration could read it back from.
"""

from __future__ import annotations

from collections.abc import Sequence

import structlog
from alembic import op
from resonand.core.text import shorten
from sqlalchemy import text

revision: str = "0006_name_limits"
down_revision: str | None = "0005_favourites"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_logger = structlog.get_logger(__name__)

# The limits as they stood when this ran, so that changing the constants later cannot change what
# an upgrade through this revision does.
TITLE_LIMIT = 200
LIBRARY_NAME_LIMIT = 100

_REINDEX_DELETE = text("DELETE FROM audio_fts WHERE rowid = :audio_id")
_REINDEX_INSERT = text(
    """
    INSERT INTO audio_fts(rowid, title, notes, tags)
    SELECT audio.id, audio.title, COALESCE(audio.notes, ''), COALESCE(
             (SELECT group_concat(tag.name, ' ')
                FROM audio_tag JOIN tag ON tag.id = audio_tag.tag_id
               WHERE audio_tag.audio_id = audio.id), '')
      FROM audio
     WHERE audio.id = :audio_id AND audio.deleted_at IS NULL
    """
)


def upgrade() -> None:
    connection = op.get_bind()
    titles = connection.execute(
        text("SELECT id, title FROM audio WHERE length(title) > :limit"), {"limit": TITLE_LIMIT}
    ).all()
    for audio_id, title in titles:
        connection.execute(
            text("UPDATE audio SET title = :title WHERE id = :audio_id"),
            {"title": shorten(title, TITLE_LIMIT), "audio_id": audio_id},
        )
        connection.execute(_REINDEX_DELETE, {"audio_id": audio_id})
        connection.execute(_REINDEX_INSERT, {"audio_id": audio_id})
    names = connection.execute(
        text("SELECT id, name FROM library WHERE length(name) > :limit"),
        {"limit": LIBRARY_NAME_LIMIT},
    ).all()
    for library_id, name in names:
        connection.execute(
            text("UPDATE library SET name = :name WHERE id = :library_id"),
            {"name": shorten(name, LIBRARY_NAME_LIMIT), "library_id": library_id},
        )
    _logger.info("names_shortened", recordings=len(titles), libraries=len(names))


def downgrade() -> None:
    pass
