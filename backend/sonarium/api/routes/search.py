"""The search endpoint (``JOB-10``, ``JOB-11``).

The product's flagship feature, and the only endpoint whose latency anybody will notice: the
promise is that you type a word and you are there in three seconds.

Results are grouped under their recording with three matches shown, and every transcript match
carries the moment to play from -- so ``UI-16`` can play from that exact second without opening
the detail view, which is the difference between a search result and a lead to follow up.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from sonarium.api.deps import CurrentCaller, ReadSession, current_caller
from sonarium.api.pagination import Page, PageRequest, page_of, page_request
from sonarium.api.presenters import audio_summary
from sonarium.api.schemas import SearchMatch, SearchResult
from sonarium.db.search import Filters, recall_note, search

router = APIRouter(prefix="/search", tags=["search"])

Paging = Annotated[PageRequest, Depends(page_request)]


def search_filters(
    library: Annotated[str | None, Query(description="Restrict to one library's uuid.")] = None,
    category_id: int | None = None,
    tag: Annotated[
        list[str] | None, Query(description="Tag slugs, all of which must match.")
    ] = None,
    recorded_from: Annotated[str | None, Query(description="Wall-clock, inclusive.")] = None,
    recorded_to: Annotated[str | None, Query(description="Wall-clock, inclusive.")] = None,
    min_duration_ms: int | None = None,
    max_duration_ms: int | None = None,
    transcription_state: Annotated[str | None, Query(pattern="^(none|done)$")] = None,
) -> Filters:
    """The filters, as one dependency (``JOB-11``).

    A dependency rather than eight parameters on the endpoint, so that the grid and the search
    apply the same filters through the same code -- which is what stops "has no transcript"
    quietly meaning two different things in two places.
    """
    return Filters(
        library_uuid=library,
        category_id=category_id,
        tag_slugs=tuple(tag or ()),
        recorded_from=recorded_from,
        recorded_to=recorded_to,
        min_duration_ms=min_duration_ms,
        max_duration_ms=max_duration_ms,
        transcription_state=transcription_state,
    )


SearchFilters = Annotated[Filters, Depends(search_filters)]


@router.get("", response_model=Page[SearchResult], summary="Search the whole archive")
def run_search(
    caller: CurrentCaller,
    session: ReadSession,
    paging: Paging,
    filters: SearchFilters,
    q: Annotated[str, Query(description="What to look for, in words.")] = "",
) -> Page[SearchResult]:
    """One ranked list over transcripts and metadata, grouped under the recording."""
    hits, total = search(
        session, caller.id, q, filters=filters, limit=paging.limit, offset=paging.offset
    )
    return page_of(
        [
            SearchResult(
                audio=audio_summary(session, hit.audio, hit.level),
                matches=[
                    SearchMatch(kind=match.kind, fragment=match.fragment, start_ms=match.start_ms)
                    for match in hit.matches
                ],
                total_matches=hit.total_matches,
            )
            for hit in hits
        ],
        total=total,
        request=paging,
    )


@router.get(
    "/about",
    summary="What this search can and cannot do",
    dependencies=[Depends(current_caller)],
)
def about_search() -> dict[str, str]:
    """``JOB-14``'s limitation, in words the interface can show.

    An endpoint rather than a hard-coded string in the frontend, so that the day the index
    changes the interface stops describing the old behaviour without anybody remembering to
    edit it.
    """
    return {"recall": recall_note()}
