"""Libraries and the grants on them (``DAT-4``, ``API-8``).

Every function that reads or changes something takes the level it requires, and gets it by going
through :mod:`sonarium.acl.query` rather than by checking anything itself. The levels are:

* **read** to see a library and what is in it,
* **edit** to change its name, description and category tree -- the same level as changing a
  recording's metadata, because that is what it is,
* **manage** to share it onwards or to delete it.

A personal library cannot be deleted or renamed away: it is what makes ``audio.library_id``
always populated, and losing it would leave an account with recordings and nowhere to put them.
"""

from __future__ import annotations

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from sonarium.acl.query import library_acl, library_select, require_library
from sonarium.core import colours
from sonarium.core.errors import ConflictError, InvalidRequestError, NotFoundError
from sonarium.core.levels import GRANTABLE, Level
from sonarium.core.time import now_instant
from sonarium.db.audio import remove_recording
from sonarium.db.models import Audio, Library, Share, User


def list_libraries(
    session: Session, user_id: int, required: Level = Level.READ
) -> list[tuple[Library, Level]]:
    """Every library this user holds ``required`` on, owned ones first, then by name."""
    rows = session.execute(
        library_select(user_id, required).order_by(Library.is_personal.desc(), Library.name)
    ).all()
    return [(row[0], Level(row[1])) for row in rows]


def library_totals(session: Session, library_id: int) -> tuple[int, int]:
    """How many recordings a library holds and how long they run to, for its header.

    Trashed recordings are excluded: a header that counts what the grid does not show is a header
    nobody trusts twice.
    """
    row = session.execute(
        select(func.count(Audio.id), func.coalesce(func.sum(Audio.duration_ms), 0)).where(
            Audio.library_id == library_id, Audio.deleted_at.is_(None)
        )
    ).one()
    return int(row[0]), int(row[1])


def create_library(
    session: Session,
    owner_id: int,
    *,
    name: str,
    description: str | None = None,
    colour: str = colours.DEFAULT.value,
) -> Library:
    """Create a library owned by this user. Anybody with an account may."""
    cleaned = name.strip()
    if not cleaned:
        raise InvalidRequestError("A library needs a name.")
    library = Library(
        owner_id=owner_id,
        name=cleaned,
        description=(description or None),
        colour=colours.Colour(colour).value,
        created_at=now_instant(),
    )
    session.add(library)
    session.flush()
    return library


def update_library(
    session: Session,
    user_id: int,
    library_uuid: str,
    *,
    name: str | None = None,
    description: str | None = None,
    colour: str | None = None,
) -> tuple[Library, Level]:
    """Rename a library, change its description, or recolour it.

    The caller's level comes back with it: resolving it is the first thing this does, and the
    endpoint would otherwise ask the ACL the same question twice inside one write (``REV-7``).
    """
    library, level = require_library(session, user_id, library_uuid, Level.EDIT)
    if name is not None:
        cleaned = name.strip()
        if not cleaned:
            raise InvalidRequestError("A library needs a name.")
        library.name = cleaned
    if description is not None:
        library.description = description or None
    if colour is not None:
        library.colour = colours.Colour(colour).value
    session.flush()
    return library, level


def trash_library(session: Session, user_id: int, library_uuid: str) -> Library:
    """Send a library to the trash, hiding it and everything in it.

    Deletion is ``deleted_at``, never a ``CASCADE``: the ACL stops resolving it and not a single
    recording row is touched, which is what makes restoring it a one-line operation.
    """
    library, _ = require_library(session, user_id, library_uuid, Level.MANAGE)
    if library.is_personal:
        raise InvalidRequestError(
            "A personal library cannot be deleted. It is where recordings go when they belong "
            "to nobody else's library."
        )
    library.deleted_at = now_instant()
    session.flush()
    return library


def restore_library(session: Session, user_id: int, library_uuid: str) -> tuple[Library, Level]:
    """Take a library back out of the trash, with the level the caller holds on it.

    The level comes back for the same reason it does from the four writes ``REV-7`` changed: the
    presenter needs it, and resolving it a second time is two more recursive CTEs inside the
    write lock.
    """
    library, level = require_library(
        session, user_id, library_uuid, Level.MANAGE, include_trashed=True
    )
    library.deleted_at = None
    session.flush()
    return library, level


def purge_library(session: Session, user_id: int, library_uuid: str) -> list[str]:
    """Destroy one trashed library now, with everything in it (``API-19``).

    Returns the uuids whose files the caller removes afterwards and outside this transaction, for
    the reason :func:`sonarium.db.audio.remove_recording` gives.

    **It takes the recordings, trashed separately or not.** That is what trashing a library already
    means -- the retention purge expires everything inside one on the library's own clock -- so
    doing it now has to destroy the same set, or Delete now would leave behind exactly the rows
    waiting a month would have taken. ``INT-1c``'s confirmation states that count before it fires.

    **Only from the trash**, and a library that is not in it answers as though it were not there,
    for the same reason :func:`sonarium.db.audio.purge_audio` does.
    """
    library, _ = require_library(session, user_id, library_uuid, Level.MANAGE, include_trashed=True)
    if library.deleted_at is None:
        raise NotFoundError("No such library in the trash.")
    rows = session.execute(select(Audio).where(Audio.library_id == library.id)).scalars().all()
    uuids = [remove_recording(session, audio) for audio in rows]
    session.delete(library)
    session.flush()
    return uuids


def list_shares(session: Session, user_id: int, library_uuid: str) -> list[tuple[Share, User]]:
    """Who has access to this library, at what level, granted by whom and when (``UI-17``)."""
    library, _ = require_library(session, user_id, library_uuid, Level.READ)
    rows = session.execute(
        select(Share, User)
        .join(User, User.id == Share.grantee_id)
        .where(Share.library_id == library.id)
        .order_by(User.display_name)
    ).all()
    return [(row[0], row[1]) for row in rows]


def share_library(
    session: Session, user_id: int, library_uuid: str, *, grantee_id: int, level: Level
) -> Share:
    """Grant somebody access to a library, or raise the level they already have.

    Requires manage. Sharing is the one thing an editor cannot do, which is the whole difference
    between the two levels.
    """
    if level not in GRANTABLE:
        raise InvalidRequestError("A share can grant read, edit or manage, and nothing else.")
    library, _ = require_library(session, user_id, library_uuid, Level.MANAGE)
    if grantee_id == library.owner_id:
        raise ConflictError("That person owns this library already.")
    if session.get(User, grantee_id) is None:
        raise NotFoundError("No such account.")
    existing = session.execute(
        select(Share).where(Share.library_id == library.id, Share.grantee_id == grantee_id)
    ).scalar_one_or_none()
    if existing is not None:
        existing.level = int(level)
        existing.granted_by = user_id
        session.flush()
        return existing
    share = Share(
        library_id=library.id,
        audio_id=None,
        grantee_id=grantee_id,
        level=int(level),
        granted_by=user_id,
        created_at=now_instant(),
    )
    session.add(share)
    session.flush()
    return share


def unshare_library(session: Session, user_id: int, library_uuid: str, *, grantee_id: int) -> None:
    """Revoke somebody's access. Takes effect on their next request, not their next sign-in."""
    library, _ = require_library(session, user_id, library_uuid, Level.MANAGE)
    share = session.execute(
        select(Share).where(Share.library_id == library.id, Share.grantee_id == grantee_id)
    ).scalar_one_or_none()
    if share is None:
        raise NotFoundError("That person does not have access to this library.")
    session.delete(share)
    session.flush()


def trashed_libraries(user_id: int) -> Select[tuple[Library, int]]:
    """What is in this user's trash at library level (``INT-1``).

    Returns the query rather than the rows, so the caller pages it through the one
    pagination envelope instead of loading a whole trash into memory to slice it.
    """
    acl = library_acl(user_id, include_trashed=True)
    return (
        select(Library, acl.c.level)
        .join(acl, acl.c.library_id == Library.id)
        .where(acl.c.level >= int(Level.MANAGE), Library.deleted_at.is_not(None))
        .order_by(Library.deleted_at)
    )
