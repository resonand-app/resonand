"""Administration (``INT-3``).

Visually separated in the interface so nobody wanders into it by accident, and separated here by
requiring an administrator on every route rather than by convention.

**Deleting a user with content is refused in v0**, with a message that says why. Ownership
transfer is the correct answer and it is a later milestone; silently orphaning somebody's archive
to avoid saying "not yet" would be worse than saying it.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import func, select

from resonand.api.deps import CurrentAdmin, ReadSession, WriteSession, current_admin
from resonand.api.presenters import admin_user
from resonand.api.schemas import AdminUser, CreateAccount, SetPassword
from resonand.api.security import hash_password
from resonand.core.errors import ConflictError, InvalidRequestError
from resonand.db import sessions as session_repo
from resonand.db import users as user_repo
from resonand.db.models import Audio, Library, Share, User

router = APIRouter(
    prefix="/admin",
    tags=["administration"],
    dependencies=[Depends(current_admin)],
)
"""Requiring the administrator on the router rather than on each route means a new endpoint
added here is protected by where it was put, not by whether somebody remembered."""


@router.get("/users", response_model=list[AdminUser])
def list_users(session: ReadSession) -> list[AdminUser]:
    rows = session.execute(select(User).order_by(User.display_name)).scalars().all()
    return [admin_user(user) for user in rows]


@router.post("/users", response_model=AdminUser, status_code=status.HTTP_201_CREATED)
def create_user(body: CreateAccount, session: WriteSession) -> AdminUser:
    """Registration is administrator-only in v0: accounts are made by hand, for people you know."""
    user = user_repo.create_user(
        session,
        email=str(body.email),
        display_name=body.display_name,
        password_hash=hash_password(body.password),
        is_admin=body.is_admin,
    )
    return admin_user(user)


@router.post("/users/{user_id}/disable", response_model=AdminUser)
def disable_user(user_id: int, admin: CurrentAdmin, session: WriteSession) -> AdminUser:
    """Disable an account. It stops resolving in the ACL on its very next request."""
    if user_id == admin.id:
        raise ConflictError("You cannot disable your own account.")
    return admin_user(user_repo.set_disabled(session, user_id, disabled=True))


@router.post("/users/{user_id}/enable", response_model=AdminUser)
def enable_user(user_id: int, session: WriteSession) -> AdminUser:
    return admin_user(user_repo.set_disabled(session, user_id, disabled=False))


@router.post("/users/{user_id}/password", status_code=status.HTTP_204_NO_CONTENT)
def set_password(user_id: int, body: SetPassword, session: WriteSession) -> None:
    """Set an account's password, ending every session it holds (``API-25``).

    Nothing else in the instance can do this. ``POST /auth/password`` needs the current password,
    which is precisely what somebody locked out does not have, and ``INT-3b`` refuses to delete an
    account that holds anything -- so before this there was no way back in and no way to tidy up
    around it either. Exit criterion 2 is a second real person using the archive; this is what
    happens to them on the day they forget it.

    **Every session goes, with no exception for the caller.** An administrator resetting their own
    password is signed out along with everybody else, which is the same rule
    ``POST /auth/password`` applies to the sessions it is not being used from: a password that has
    changed should not leave a door open behind it. The reason to reset is usually that somebody
    else may have had it, and the sessions are the part that survives the change.
    """
    user = user_repo.get_user(session, user_id)
    user.password_hash = hash_password(body.password)
    session_repo.revoke_all(session, user_id)


def _plural(count: int, one: str, many: str) -> str:
    """A count with the right noun on it, because the refusal is read rather than parsed."""
    return f"{count} {one if count == 1 else many}"


def _holds(session: WriteSession, user_id: int) -> list[str]:
    """Everything an account is attached to that deleting it would take down with it.

    Ownership is the obvious half and was the only half. The other two are rows that merely
    *point* at the account -- a recording somebody uploaded into a library they do not own, and a
    share they granted on one -- and both columns are ``NOT NULL`` with no ``ON DELETE``, so the
    delete aborts against a foreign key and the administrator is shown "Unexpected error". That
    is the outcome ``INT-3b``'s refusal exists to replace, so the refusal has to count them
    (``INT-3b1``).
    """
    counted: list[tuple[int, str, str]] = [
        (
            int(
                session.execute(
                    select(func.count(Library.id)).where(
                        Library.owner_id == user_id, Library.is_personal == 0
                    )
                ).scalar_one()
            ),
            "library",
            "libraries",
        ),
        (
            int(
                session.execute(
                    select(func.count(Audio.id))
                    .join(Library, Library.id == Audio.library_id)
                    .where(Library.owner_id == user_id)
                ).scalar_one()
            ),
            "recording",
            "recordings",
        ),
        (
            int(
                session.execute(
                    select(func.count(Audio.id))
                    .join(Library, Library.id == Audio.library_id)
                    .where(Audio.uploaded_by == user_id, Library.owner_id != user_id)
                ).scalar_one()
            ),
            "recording uploaded to somebody else's library",
            "recordings uploaded to other people's libraries",
        ),
        (
            int(
                session.execute(
                    select(func.count(Share.id)).where(Share.granted_by == user_id)
                ).scalar_one()
            ),
            "share they granted",
            "shares they granted",
        ),
    ]
    return [_plural(count, one, many) for count, one, many in counted if count]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: WriteSession) -> None:
    """Delete an account that has nothing in it. Anything else is refused, with the numbers."""
    user = user_repo.get_user(session, user_id)
    holds = _holds(session, user_id)
    if holds:
        listed = holds[0] if len(holds) == 1 else f"{', '.join(holds[:-1])} and {holds[-1]}"
        raise InvalidRequestError(
            f"{user.display_name} has {listed}. Deleting the account would take them with it, and "
            "transferring ownership is not built yet. Disable the account instead: it keeps the "
            "recordings and stops the person signing in."
        )
    # Whatever is left is empty and nobody else's: the count above refused anything the account
    # made itself, so this is the library it was created with, or nothing where that was purged.
    for library in session.execute(select(Library).where(Library.owner_id == user_id)).scalars():
        session.delete(library)
    session.delete(user)
    session.flush()
