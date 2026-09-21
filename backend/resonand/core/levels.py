"""Permission levels.

Integers rather than names, because that is what makes the union of permissions resolve in the
query itself: SQLite's scalar ``MAX()`` over ownership, a library grant and an individual grant
literally implements "the highest permission wins", with no branch in the application layer that
could disagree with the database about who can see what.

Only 10, 20 and 30 are grantable. **Ownership is not a grant** -- it is read off
``library.owner_id``, and a ``share`` row carrying 40 is refused by a ``CHECK`` in the schema.
"""

from __future__ import annotations

from enum import IntEnum


class Level(IntEnum):
    """What somebody may do with a recording or a library."""

    READ = 10
    """See it, play it, read its transcript."""

    EDIT = 20
    """Change its title, notes, recording date, category and tags."""

    MANAGE = 30
    """Everything above, plus sharing it onwards."""

    OWNER = 40
    """The library's owner. Never granted, only held."""


GRANTABLE: tuple[Level, ...] = (Level.READ, Level.EDIT, Level.MANAGE)
"""The levels a ``share`` row may carry. The interface explains these in plain language."""

DESCRIPTIONS: dict[Level, str] = {
    Level.READ: "Can read: listen and read the transcript, and change nothing.",
    Level.EDIT: "Can edit: change titles, categories and tags, but not share.",
    Level.MANAGE: "Can manage: everything above, plus sharing with other people.",
    Level.OWNER: "Owner: the library belongs to them.",
}
"""The wording ``UI-17`` uses. Kept next to the levels so the interface and the model cannot
drift into describing different things."""
