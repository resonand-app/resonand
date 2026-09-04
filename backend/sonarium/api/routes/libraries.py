"""Libraries, their category tree and the grants on them (``API-8``).

Libraries are addressed by ``uuid``; categories are not, because they are only ever reached
through a library the caller can already read (``DEC-14``).

The share endpoints already accept the shape that individual-recording sharing will need. Only
library-level grants are offered in v0, and the endpoint that would grant one on a recording is
simply not routed -- the resolution behind it has been in place and tested since ``DAT-3``.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status

from sonarium.acl.query import require_library
from sonarium.api.deps import CurrentCaller, ReadSession, WriteSession
from sonarium.api.pagination import Page, PageRequest, page_of, page_request
from sonarium.api.presenters import (
    audio_summaries,
    category_summary,
    library_summary,
    share_summary,
)
from sonarium.api.schemas import (
    AudioSummary,
    CategorySummary,
    CreateCategory,
    CreateLibrary,
    CreateShare,
    LibrarySummary,
    ReorderCategories,
    ShareSummary,
    UpdateCategory,
    UpdateLibrary,
)
from sonarium.core.errors import NotFoundError
from sonarium.core.levels import Level
from sonarium.db import categories as category_repo
from sonarium.db import libraries as library_repo
from sonarium.db.audio import library_audio
from sonarium.db.models import User

router = APIRouter(prefix="/libraries", tags=["libraries"])

Paging = Annotated[PageRequest, Depends(page_request)]


@router.get("", response_model=list[LibrarySummary], summary="Libraries you can see")
def list_libraries(caller: CurrentCaller, session: ReadSession) -> list[LibrarySummary]:
    """Owned libraries first, then shared ones -- which is the sidebar's own order (``UI-4``)."""
    return [
        library_summary(session, library, level)
        for library, level in library_repo.list_libraries(session, caller.id)
    ]


@router.post("", response_model=LibrarySummary, status_code=status.HTTP_201_CREATED)
def create_library(
    body: CreateLibrary, caller: CurrentCaller, session: WriteSession
) -> LibrarySummary:
    library = library_repo.create_library(
        session, caller.id, name=body.name, description=body.description, colour=body.colour.value
    )
    return library_summary(session, library, Level.OWNER)


@router.get("/{library_uuid}", response_model=LibrarySummary)
def get_library(library_uuid: str, caller: CurrentCaller, session: ReadSession) -> LibrarySummary:
    library, level = require_library(session, caller.id, library_uuid)
    return library_summary(session, library, level)


@router.patch("/{library_uuid}", response_model=LibrarySummary)
def update_library(
    library_uuid: str, body: UpdateLibrary, caller: CurrentCaller, session: WriteSession
) -> LibrarySummary:
    library = library_repo.update_library(
        session,
        caller.id,
        library_uuid,
        name=body.name,
        description=body.description,
        colour=body.colour.value if body.colour is not None else None,
    )
    _, level = require_library(session, caller.id, library_uuid)
    return library_summary(session, library, level)


@router.delete("/{library_uuid}", status_code=status.HTTP_204_NO_CONTENT)
def trash_library(library_uuid: str, caller: CurrentCaller, session: WriteSession) -> None:
    """Send a library to the trash. Nothing is deleted until the retention period runs out."""
    library_repo.trash_library(session, caller.id, library_uuid)


@router.post("/{library_uuid}/restore", response_model=LibrarySummary)
def restore_library(
    library_uuid: str, caller: CurrentCaller, session: WriteSession
) -> LibrarySummary:
    library = library_repo.restore_library(session, caller.id, library_uuid)
    return library_summary(session, library, Level.OWNER)


@router.get("/{library_uuid}/audio", response_model=Page[AudioSummary])
def list_library_audio(
    library_uuid: str, caller: CurrentCaller, session: ReadSession, paging: Paging
) -> Page[AudioSummary]:
    """What is in a library, newest recording first."""
    query = library_audio(session, caller.id, library_uuid)
    total = len(session.execute(query).all())
    rows = session.execute(query.limit(paging.limit).offset(paging.offset)).all()
    return page_of(
        audio_summaries(session, [(row[0], row[1]) for row in rows]),
        total=total,
        request=paging,
    )


# --- Sharing --------------------------------------------------------------


@router.get("/{library_uuid}/shares", response_model=list[ShareSummary])
def list_shares(
    library_uuid: str, caller: CurrentCaller, session: ReadSession
) -> list[ShareSummary]:
    return [
        share_summary(share, grantee)
        for share, grantee in library_repo.list_shares(session, caller.id, library_uuid)
    ]


@router.put("/{library_uuid}/shares", response_model=ShareSummary)
def share_library(
    library_uuid: str, body: CreateShare, caller: CurrentCaller, session: WriteSession
) -> ShareSummary:
    """Grant access, or change the level somebody already has. Requires manage."""
    share = library_repo.share_library(
        session, caller.id, library_uuid, grantee_id=body.grantee_id, level=body.level
    )
    grantee = session.get(User, body.grantee_id)
    if grantee is None:  # pragma: no cover -- share_library already refused an unknown one
        raise NotFoundError("No such account.")
    return share_summary(share, grantee)


@router.delete("/{library_uuid}/shares/{grantee_id}", status_code=status.HTTP_204_NO_CONTENT)
def unshare_library(
    library_uuid: str, grantee_id: int, caller: CurrentCaller, session: WriteSession
) -> None:
    library_repo.unshare_library(session, caller.id, library_uuid, grantee_id=grantee_id)


# --- The category tree ----------------------------------------------------


@router.get("/{library_uuid}/categories", response_model=list[CategorySummary])
def list_categories(
    library_uuid: str, caller: CurrentCaller, session: ReadSession
) -> list[CategorySummary]:
    return [
        category_summary(category)
        for category in category_repo.list_categories(session, caller.id, library_uuid)
    ]


@router.post(
    "/{library_uuid}/categories",
    response_model=CategorySummary,
    status_code=status.HTTP_201_CREATED,
)
def create_category(
    library_uuid: str, body: CreateCategory, caller: CurrentCaller, session: WriteSession
) -> CategorySummary:
    return category_summary(
        category_repo.create_category(
            session, caller.id, library_uuid, name=body.name, parent_id=body.parent_id
        )
    )


@router.patch("/{library_uuid}/categories/{category_id}", response_model=CategorySummary)
def update_category(
    library_uuid: str,
    category_id: int,
    body: UpdateCategory,
    caller: CurrentCaller,
    session: WriteSession,
) -> CategorySummary:
    """Rename or re-parent one node. Moving it into its own subtree is refused."""
    require_library(session, caller.id, library_uuid, Level.EDIT)
    category = category_repo.get_category(session, caller.id, category_id, Level.EDIT)
    if body.name is not None:
        category = category_repo.rename_category(session, caller.id, category_id, name=body.name)
    if body.clear_parent or body.parent_id is not None:
        category = category_repo.move_category(
            session, caller.id, category_id, parent_id=None if body.clear_parent else body.parent_id
        )
    return category_summary(category)


@router.post("/{library_uuid}/categories/order", response_model=list[CategorySummary])
def reorder_categories(
    library_uuid: str,
    body: ReorderCategories,
    caller: CurrentCaller,
    session: WriteSession,
) -> list[CategorySummary]:
    require_library(session, caller.id, library_uuid, Level.EDIT)
    return [
        category_summary(category)
        for category in category_repo.reorder_categories(session, caller.id, body.ordered_ids)
    ]


@router.delete("/{library_uuid}/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    library_uuid: str, category_id: int, caller: CurrentCaller, session: WriteSession
) -> None:
    """Remove a node, uncategorising anything that was in it rather than refusing."""
    require_library(session, caller.id, library_uuid, Level.EDIT)
    category_repo.delete_category(session, caller.id, category_id)
