"""The single entry point to ``audio`` (``DAT-3``).

**No other part of the backend queries ``audio`` directly.** Every endpoint, every search and
every future MCP tool composes on top of what is here, so that there is exactly one description of
who can see what and no application-layer check that could disagree with it.

The resolution is the specification's query, unchanged in substance: a scalar ``MAX()`` over
ownership, a grant on the library and a grant on the recording itself. Because the grants are
``LEFT JOIN``ed and resolved at query time, sharing a library automatically covers recordings
added to it afterwards, and revoking it covers them too -- there is no denormalised copy to go
stale.

Three things it adds to the specification, each because something else in the plan promised it:

* **A disabled account resolves to nothing.** ``DAT-3``'s test matrix lists a disabled user, and
  the only place that can be enforced once is here. An account disabled while somebody is holding
  a session stops being able to read on its next request, not on its next sign-in.
* **The trash is a parameter, not a second query.** ``INT-1`` has to list what has been deleted,
  and giving it its own path would be a second description of the same permissions.
* **Refusals are graded** (``DEC-14``). Below :attr:`~sonarium.core.levels.Level.READ` the answer
  is *it does not exist*; at or above it, the answer is *you may not do that to it*. A 403 on
  something you cannot read would confirm it exists, which is the one thing the ACL is there to
  withhold -- and a 404 on something you are looking at would be a lie.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CTE, Select, and_, case, func, select
from sqlalchemy.orm import Session, aliased

from sonarium.core.errors import NotFoundError, PermissionDeniedError
from sonarium.core.levels import Level
from sonarium.db.models import Audio, Library, Share, User

if TYPE_CHECKING:
    from collections.abc import Sequence

NO_ACCESS = 0
"""What a missing grant contributes to the maximum. Not a level: no level is zero."""


def audio_acl(user_id: int, *, include_trashed: bool = False) -> CTE:
    """The resolved level this user holds on every recording they can reach.

    Recordings they hold nothing on are absent rather than present at zero, which is what lets
    every caller express its filter as ``level >= required`` and nothing else.
    """
    library_grant = aliased(Share, name="library_grant")
    audio_grant = aliased(Share, name="audio_grant")

    resolved = select(
        Audio.id.label("audio_id"),
        func.max(
            case((Library.owner_id == user_id, int(Level.OWNER)), else_=NO_ACCESS),
            func.coalesce(library_grant.level, NO_ACCESS),
            func.coalesce(audio_grant.level, NO_ACCESS),
        ).label("level"),
    ).select_from(Audio)

    resolved = (
        resolved.join(Library, Library.id == Audio.library_id)
        .join(User, and_(User.id == user_id, User.disabled_at.is_(None)))
        .outerjoin(
            library_grant,
            and_(library_grant.library_id == Library.id, library_grant.grantee_id == user_id),
        )
        .outerjoin(
            audio_grant,
            and_(audio_grant.audio_id == Audio.id, audio_grant.grantee_id == user_id),
        )
    )
    if not include_trashed:
        resolved = resolved.where(Audio.deleted_at.is_(None), Library.deleted_at.is_(None))
    return resolved.cte("acl")


def library_acl(user_id: int, *, include_trashed: bool = False) -> CTE:
    """The same resolution for libraries, which are shared as wholes.

    An individual recording grant deliberately does **not** give access to its library: it gives
    access to one recording, and the library it happens to sit in stays invisible.
    """
    grant = aliased(Share, name="library_grant")
    resolved = (
        select(
            Library.id.label("library_id"),
            func.max(
                case((Library.owner_id == user_id, int(Level.OWNER)), else_=NO_ACCESS),
                func.coalesce(grant.level, NO_ACCESS),
            ).label("level"),
        )
        .select_from(Library)
        .join(User, and_(User.id == user_id, User.disabled_at.is_(None)))
        .outerjoin(grant, and_(grant.library_id == Library.id, grant.grantee_id == user_id))
    )
    if not include_trashed:
        resolved = resolved.where(Library.deleted_at.is_(None))
    return resolved.cte("library_acl")


def audio_select(
    user_id: int,
    required: Level = Level.READ,
    *,
    include_trashed: bool = False,
) -> Select[tuple[Audio, int]]:
    """Every recording this user holds ``required`` on, with the level they hold.

    This is what listing, filtering and searching all start from. A caller adds its own ``where``
    and ``order_by``; it never adds a permission clause, because there is nothing left to add.
    """
    acl = audio_acl(user_id, include_trashed=include_trashed)
    return (
        select(Audio, acl.c.level)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(acl.c.level >= int(required))
    )


def library_select(
    user_id: int,
    required: Level = Level.READ,
    *,
    include_trashed: bool = False,
) -> Select[tuple[Library, int]]:
    """Every library this user holds ``required`` on, with the level they hold."""
    acl = library_acl(user_id, include_trashed=include_trashed)
    return (
        select(Library, acl.c.level)
        .join(acl, acl.c.library_id == Library.id)
        .where(acl.c.level >= int(required))
    )


def audio_level(
    session: Session, user_id: int, audio_uuid: str, *, include_trashed: bool = False
) -> Level | None:
    """The level this user holds on one recording, or ``None`` when they hold nothing.

    Returning ``None`` rather than raising is for the caller that has to distinguish the two
    outcomes -- listing a search result, deciding whether to offer an edit control. The callers
    that just want the recording use :func:`require_audio`.
    """
    acl = audio_acl(user_id, include_trashed=include_trashed)
    found = session.execute(
        select(acl.c.level).join(Audio, Audio.id == acl.c.audio_id).where(Audio.uuid == audio_uuid)
    ).scalar_one_or_none()
    if found is None or found < int(Level.READ):
        return None
    return Level(found)


def require_audio(
    session: Session,
    user_id: int,
    audio_uuid: str,
    required: Level = Level.READ,
    *,
    include_trashed: bool = False,
) -> tuple[Audio, Level]:
    """Fetch one recording, or refuse in the one way that does not leak its existence.

    Below :attr:`~sonarium.core.levels.Level.READ` this raises
    :class:`~sonarium.core.errors.NotFoundError` whether the recording is missing, trashed or
    merely somebody else's -- the caller cannot tell which, and that is the point (``DEC-14``).
    Above it, a level that is not enough for what was asked raises
    :class:`~sonarium.core.errors.PermissionDeniedError`, because pretending a recording the user
    is looking at does not exist would just be a confusing lie.
    """
    acl = audio_acl(user_id, include_trashed=include_trashed)
    row = session.execute(
        select(Audio, acl.c.level)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(Audio.uuid == audio_uuid)
    ).one_or_none()
    if row is None or row[1] < int(Level.READ):
        raise NotFoundError("No such recording.")
    audio, level = row[0], Level(row[1])
    if level < required:
        raise PermissionDeniedError(_refusal(required))
    return audio, level


def require_library(
    session: Session,
    user_id: int,
    library_uuid: str,
    required: Level = Level.READ,
    *,
    include_trashed: bool = False,
) -> tuple[Library, Level]:
    """Fetch one library under the same rule as :func:`require_audio`."""
    acl = library_acl(user_id, include_trashed=include_trashed)
    row = session.execute(
        select(Library, acl.c.level)
        .join(acl, acl.c.library_id == Library.id)
        .where(Library.uuid == library_uuid)
    ).one_or_none()
    if row is None or row[1] < int(Level.READ):
        raise NotFoundError("No such library.")
    library, level = row[0], Level(row[1])
    if level < required:
        raise PermissionDeniedError(_refusal(required))
    return library, level


def readable_audio_ids(
    session: Session, user_id: int, required: Level = Level.READ
) -> Sequence[int]:
    """The internal ids this user holds ``required`` on.

    For the few places that need a set rather than a query -- a bulk action confirming what it is
    about to touch. Anything that can compose on :func:`audio_select` should do that instead, so
    the ACL stays inside the query rather than becoming a list the database has to be handed back.
    """
    acl = audio_acl(user_id)
    return (
        session.execute(select(acl.c.audio_id).where(acl.c.level >= int(required))).scalars().all()
    )


def _refusal(required: Level) -> str:
    """What to say when the answer is no but the thing is visible."""
    if required is Level.EDIT:
        return "You can read this, but not change it."
    if required is Level.MANAGE:
        return "You can read this, but not share it or manage who else can."
    return "You do not have permission to do that."
