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

from sonarium.api.deps import CurrentAdmin, ReadSession, WriteSession, current_admin
from sonarium.api.presenters import admin_user
from sonarium.api.schemas import AdminUser, CreateAccount
from sonarium.api.security import hash_password
from sonarium.core.errors import ConflictError, InvalidRequestError
from sonarium.db import users as user_repo
from sonarium.db.models import Audio, Library, User

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


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, session: WriteSession) -> None:
    """Delete an account that has nothing in it. Anything else is refused, with the numbers."""
    user = user_repo.get_user(session, user_id)
    libraries = int(
        session.execute(
            select(func.count(Library.id)).where(
                Library.owner_id == user_id, Library.is_personal == 0
            )
        ).scalar_one()
    )
    recordings = int(
        session.execute(
            select(func.count(Audio.id))
            .join(Library, Library.id == Audio.library_id)
            .where(Library.owner_id == user_id)
        ).scalar_one()
    )
    if libraries or recordings:
        raise InvalidRequestError(
            f"{user.display_name} owns {libraries} librar"
            f"{'y' if libraries == 1 else 'ies'} and {recordings} recording"
            f"{'' if recordings == 1 else 's'}. Deleting the account would take them with it, and "
            "transferring ownership is not built yet. Disable the account instead: it keeps the "
            "recordings and stops the person signing in."
        )
    # Whatever is left is empty and nobody else's: the count above refused anything the account
    # made itself, so this is the library it was created with, or nothing where that was purged.
    for library in session.execute(select(Library).where(Library.owner_id == user_id)).scalars():
        session.delete(library)
    session.delete(user)
    session.flush()
