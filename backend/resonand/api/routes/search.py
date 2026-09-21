"""The search endpoint (``JOB-10``, ``JOB-11``).

The product's flagship feature, and the only endpoint whose latency anybody will notice: the
promise is that you type a word and you are there in three seconds.

Results are grouped under their recording with three matches shown, and every transcript match
carries the moment to play from -- so ``UI-16`` can play from that exact second without opening
the detail view, which is the difference between a search result and a lead to follow up.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from resonand.api.deps import CurrentCaller, ReadSession, current_caller
from resonand.api.filters import RecordingFilters
from resonand.api.pagination import Page, PageRequest, page_of, page_request
from resonand.api.presenters import audio_summary
from resonand.api.schemas import SearchMatch, SearchResult
from resonand.db.search import Filters, recall_note, search

router = APIRouter(prefix="/search", tags=["search"])

Paging = Annotated[PageRequest, Depends(page_request)]


def search_filters(
    filters: RecordingFilters,
    library: Annotated[str | None, Query(description="Restrict to one library's uuid.")] = None,
) -> Filters:
    """The filter bar's parameters, plus the one only search has (``JOB-11``).

    Search can be told to look in one library; the library grid already knows which one it is
    looking at, so ``library`` is the only difference between the two and everything else comes
    from :func:`resonand.api.filters.recording_filters` -- the same code, so a filter cannot
    behave one way here and another way on the grid.
    """
    return replace(filters, library_uuid=library)


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
