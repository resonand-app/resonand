"""The dependencies every endpoint takes (``API-2``).

**No endpoint checks permissions on its own.** It declares which of these it needs, and the
answer arrives already resolved: who the caller is, a session to work through, and -- through
:mod:`sonarium.acl.query` -- what they may do. An endpoint that forgets is caught by ``INT-5``,
which walks every route and fails if any of them reached the database without going through here.

The database arrives as a dependency rather than as a module-level singleton so that a test can
hand the application a temporary archive. That is the only reason; there is one database per
process at runtime.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session as DbSession

from sonarium.core.config import Settings, get_settings
from sonarium.core.errors import PermissionDeniedError, UnauthenticatedError
from sonarium.db import sessions
from sonarium.db.engine import Database, get_database
from sonarium.db.models import Session, User

if TYPE_CHECKING:
    from collections.abc import Iterator


@dataclass(frozen=True, slots=True)
class Caller:
    """Who is making this request, and through which session."""

    user: User
    session: Session

    @property
    def id(self) -> int:
        """The account's internal id, which is what the ACL is parameterised on."""
        return self.user.id

    @property
    def is_admin(self) -> bool:
        return bool(self.user.is_admin)


def settings_of(request: Request) -> Settings:
    """This instance's settings, taken off the application rather than re-read per request."""
    stored = getattr(request.app.state, "settings", None)
    return stored if isinstance(stored, Settings) else get_settings()


def database_of(request: Request) -> Database:
    """The archive. Overridden in tests; a singleton at runtime."""
    stored = getattr(request.app.state, "database", None)
    return stored if isinstance(stored, Database) else get_database()


def reading(database: Annotated[Database, Depends(database_of)]) -> Iterator[DbSession]:
    """A read session. Free and concurrent; never takes the write lock."""
    with database.read_session() as session:
        yield session


def writing(database: Annotated[Database, Depends(database_of)]) -> Iterator[DbSession]:
    """A write session. Serialised, committed when the endpoint returns without raising."""
    with database.write_session() as session:
        yield session


ReadSession = Annotated[DbSession, Depends(reading)]
WriteSession = Annotated[DbSession, Depends(writing)]
InstanceSettings = Annotated[Settings, Depends(settings_of)]


def current_caller(
    request: Request,
    session: ReadSession,
    settings: InstanceSettings,
) -> Caller:
    """Resolve the session cookie, or refuse.

    Every reason to refuse produces the same answer, because distinguishing "no cookie" from
    "revoked" from "the account was disabled" tells whoever is holding a stale cookie something
    about the instance that they have no business learning.
    """
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise UnauthenticatedError("Sign in to continue.")
    resolved = sessions.resolve_session(session, token)
    if resolved is None:
        raise UnauthenticatedError("Sign in to continue.")
    row, user = resolved
    request.state.user_id = user.id
    return Caller(user=user, session=row)


CurrentCaller = Annotated[Caller, Depends(current_caller)]


def current_admin(caller: CurrentCaller) -> Caller:
    """The same, but refusing anybody who is not an administrator.

    This is a 403 rather than a 404: the caller is signed in and knows perfectly well that an
    administration area exists. Hiding it would not withhold anything.
    """
    if not caller.is_admin:
        raise PermissionDeniedError("That is an administrator's action.")
    return caller


CurrentAdmin = Annotated[Caller, Depends(current_admin)]


def optional_caller(
    request: Request,
    session: ReadSession,
    settings: InstanceSettings,
) -> Caller | None:
    """For the few endpoints that answer differently when signed in but do not require it."""
    try:
        return current_caller(request, session, settings)
    except UnauthenticatedError:
        return None


OptionalCaller = Annotated[Caller | None, Depends(optional_caller)]
