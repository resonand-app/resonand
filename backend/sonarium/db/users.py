"""Accounts, and the library that is created with them (``DAT-5``).

The personal library is the reason ``audio.library_id`` can be ``NOT NULL``: there is no such
thing as a loose recording, so the permission model has one path through it and no special case
for content that belongs to nobody's library. That only holds if **no path can create a user
without one**, which is why the two writes are in one function and one transaction rather than in
a service that remembers to do both.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from sonarium.core.errors import ConflictError, NotFoundError
from sonarium.core.text import normalise_email
from sonarium.core.time import now_instant
from sonarium.db.models import Library, User

PERSONAL_LIBRARY_NAME = "Personal"


def create_user(
    session: Session,
    *,
    email: str,
    display_name: str,
    password_hash: str | None = None,
    is_admin: bool = False,
) -> User:
    """Create an account and its personal library, or refuse.

    The caller supplies an already-hashed password: this module never sees a plaintext one, so
    there is no path by which one could be logged.
    """
    normalised = normalise_email(email)
    if find_by_email(session, normalised) is not None:
        raise ConflictError(f"An account already exists for {normalised}.")
    user = User(
        email=email.strip(),
        email_normalised=normalised,
        display_name=display_name.strip() or normalised,
        password_hash=password_hash,
        is_admin=int(is_admin),
        created_at=now_instant(),
    )
    session.add(user)
    session.flush()
    session.add(
        Library(
            owner_id=user.id,
            name=PERSONAL_LIBRARY_NAME,
            is_personal=1,
            created_at=now_instant(),
        )
    )
    session.flush()
    return user


def find_by_email(session: Session, email: str) -> User | None:
    """Look an account up by address, on the key rather than on the typed form."""
    return session.execute(
        select(User).where(User.email_normalised == normalise_email(email))
    ).scalar_one_or_none()


def get_user(session: Session, user_id: int) -> User:
    """Fetch an account, or say it is not there."""
    user = session.get(User, user_id)
    if user is None:
        raise NotFoundError("No such account.")
    return user


def personal_library(session: Session, user_id: int) -> Library:
    """The library created with this account. Always exists; not being there is a bug."""
    library = session.execute(
        select(Library).where(Library.owner_id == user_id, Library.is_personal == 1)
    ).scalar_one_or_none()
    if library is None:
        raise NotFoundError(f"Account {user_id} has no personal library, which cannot happen.")
    return library


def set_disabled(session: Session, user_id: int, *, disabled: bool) -> User:
    """Disable or re-enable an account.

    Disabling is the only exit in v0: deleting a user who owns content is refused, because
    ownership transfer is not built yet and silently orphaning an archive is worse than a message
    saying why (``INT-3``).
    """
    user = get_user(session, user_id)
    user.disabled_at = now_instant() if disabled else None
    session.flush()
    return user


def count_users(session: Session) -> int:
    """How many accounts exist. ``API-7`` uses it to decide whether this is the first run."""
    return len(session.execute(select(User.id)).scalars().all())
