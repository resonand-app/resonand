"""Accounts, and the library that is created with them (``DAT-5``).

An account is created with a library, and that is the reason ``audio.library_id`` can be ``NOT
NULL``: there is no such thing as a loose recording, so the permission model has one path through
it and no special case for content that belongs to nobody's library. That only holds if **no path
can create a user without one**, which is why the two writes are in one function and one
transaction rather than in a service that remembers to do both -- and, from then on, because
:func:`resonand.db.libraries.trash_library` refuses to take an account's last one away.

The library created here carries ``is_personal``, which is what puts it first in every list and
what the sharing panel reads. It is not what makes it undeletable: since ``DAT-9`` nothing is,
once a second library exists to take its place.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from resonand.core.errors import ConflictError, NotFoundError
from resonand.core.text import normalise_email
from resonand.core.time import now_instant
from resonand.db.models import Library, User

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


def update_profile(
    session: Session,
    user_id: int,
    *,
    display_name: str | None = None,
    email: str | None = None,
    language: str | None = None,
    clear_language: bool = False,
) -> User:
    """Change what somebody may change about their own account (``API-13``).

    Every argument defaults to "leave this alone", so one endpoint serves a rename, an address
    change and a language change without a caller having to send back the fields it is not
    touching.

    **Changing an address re-derives ``email_normalised``**, which is the unique key, and
    conflicts the same way creating an account does. The typed form is kept as typed, because it
    is what somebody recognises as their address; the normalised one is what identity is decided
    on (``DEC-15``).

    ``clear_language`` exists because ``None`` already means "leave it", and a null language --
    follow the instance default -- has to remain reachable.
    """
    user = get_user(session, user_id)
    if display_name is not None:
        user.display_name = display_name.strip() or user.display_name
    if email is not None:
        normalised = normalise_email(email)
        existing = find_by_email(session, normalised)
        if existing is not None and existing.id != user_id:
            raise ConflictError(f"An account already exists for {normalised}.")
        user.email = email.strip()
        user.email_normalised = normalised
    if clear_language:
        user.language = None
    elif language is not None:
        user.language = language.strip()
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
    """The library created with this account, which exists until somebody deletes it.

    It is there from the moment the account is, and ``DAT-9`` made it deletable like any other
    once a second library exists -- so its absence is an ordinary state rather than the bug this
    used to report.
    """
    library = session.execute(
        select(Library).where(Library.owner_id == user_id, Library.is_personal == 1)
    ).scalar_one_or_none()
    if library is None:
        raise NotFoundError(f"Account {user_id} no longer has the library it was created with.")
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
    """How many accounts exist. ``API-7`` uses it to decide whether this is the first run.

    Counted in SQL rather than by hydrating every id: the answer is one integer and building a
    list to measure it grows with the archive for nothing (``REV-2``).
    """
    return session.execute(select(func.count()).select_from(User)).scalar_one()
