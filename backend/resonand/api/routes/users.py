"""Finding one person to share a library with (``API-15``, ``UI-17d``).

Only administrators could list accounts, so a library manager on a family instance could not
resolve who to share with -- and ``PUT /shares`` takes an account id, which they had no way to
discover.

**This is deliberately not a directory, and the shape is the whole design.** It matches on the
full normalised address and returns at most one account. A prefix search, or a search by name,
would let anybody holding manage on one library enumerate every account on the instance -- the
same class of leak the ACL-filtered tag suggestions already exist to prevent. Sharing needs to
confirm one address somebody was given out of band; it does not need to browse.

Finding nobody is an empty list rather than a 404, because "no account has that address" is a
state the form draws under the field, not an error.
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


@router.get("/users/lookup", response_model=list[UserSummary], summary="Find one person by address")
def lookup_user(
    caller: CurrentCaller,
    session: ReadSession,
    email: Annotated[EmailAddress, Query(description="A full address. Nothing shorter matches.")],
) -> list[UserSummary]:
    """At most one account, for somebody who manages at least one library.

    A disabled account is not returned: the ACL refuses one anyway, so offering it would offer a
    share that could never work.
    """
    if not manages_any_library(session, caller.id):
        raise PermissionDeniedError("Only somebody who manages a library can look a person up.")
    found = users.find_by_email(session, email)
    if found is None or found.disabled_at is not None:
        return []
    return [user_summary(found)]
