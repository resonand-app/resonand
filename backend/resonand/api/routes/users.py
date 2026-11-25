"""Who a library can be shared with (``DEC-29``, ``API-29``; ``API-15`` before it).

Only administrators could list accounts, so a library manager on a family instance could not
resolve who to share with -- and ``PUT /shares`` takes an account id, which they had no way to
discover.

**This is a directory, on purpose.** ``DEC-29`` decided that somebody choosing who to share with
picks from the instance's accounts rather than typing an address they were given out of band.
The cost is named there and accepted: anybody who manages a library -- which is every account --
can read the name and address of every active account on the instance. On the family instance
Resonand is built for, those are people who already know each other.

``GET /users/lookup`` stays for clients written against ``0.1`` and ``0.2``, and is deprecated
rather than removed: the interface no longer calls it, and a minor release that took it away
would break a script for nothing it protects any more.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from resonand.acl.query import manages_any_library
from resonand.api.deps import CurrentCaller, ReadSession
from resonand.api.presenters import user_summary
from resonand.api.schemas import EmailAddress, UserSummary
from resonand.core.errors import PermissionDeniedError
from resonand.db import users

router = APIRouter(tags=["accounts"])


def _require_manager(session: ReadSession, caller_id: int) -> None:
    if not manages_any_library(session, caller_id):
        raise PermissionDeniedError("Only somebody who manages a library can look a person up.")


@router.get("/users", response_model=list[UserSummary], summary="Everybody a library can go to")
def list_shareable(caller: CurrentCaller, session: ReadSession) -> list[UserSummary]:
    """Every active account but the caller's, by name, for somebody who manages a library."""
    _require_manager(session, caller.id)
    return [user_summary(user) for user in users.shareable_with(session, caller.id)]


@router.get(
    "/users/lookup",
    response_model=list[UserSummary],
    summary="Find one person by address",
    deprecated=True,
)
def lookup_user(
    caller: CurrentCaller,
    session: ReadSession,
    email: Annotated[EmailAddress, Query(description="A full address. Nothing shorter matches.")],
) -> list[UserSummary]:
    """At most one account, matched on the whole normalised address. Use ``GET /users``.

    A disabled account is not returned: the ACL refuses one anyway, so offering it would offer a
    share that could never work.
    """
    _require_manager(session, caller.id)
    found = users.find_by_email(session, email)
    if found is None or found.disabled_at is not None:
        return []
    return [user_summary(found)]
