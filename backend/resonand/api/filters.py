"""The filters and the sort a recording list takes (``JOB-11``, ``API-10``).

**One dependency, three endpoints.** The library grid, the search view and the listing across
libraries draw the same filter bar -- the same tags, the same four state toggles, and a category
picker wherever there is one library to pick from -- so they read the same parameters here and
apply them through the same :func:`resonand.db.search.apply_filters`. Writing
the grid's filters separately is how "has no transcript" ends up quietly meaning two different
things in two places, which is the failure ``UI-8c`` is written against.

The sort is here for the same reason. ``UI-7d`` puts a sort control in the filter bar *and*
click-to-sort on the column headings, and calls them one sort expressed two ways; that is only
true if there is one list of sort fields.
"""

from __future__ import annotations

from dataclasses import replace
from typing import Annotated

from fastapi import Depends, Query

from resonand.api.deps import CurrentCaller
from resonand.core.states import TranscriptionState
from resonand.db.search import Filters, SortDirection, SortField


def archive_filters(
    caller: CurrentCaller,
    tag: Annotated[
        list[str] | None, Query(description="Tag slugs, all of which must match.")
    ] = None,
    recorded_from: Annotated[str | None, Query(description="Wall-clock, inclusive.")] = None,
    recorded_to: Annotated[str | None, Query(description="Wall-clock, inclusive.")] = None,
    min_duration_ms: int | None = None,
    max_duration_ms: int | None = None,
    transcription_state: Annotated[
        list[TranscriptionState] | None,
        Query(description="Any of the four states. Repeat it to mean either."),
    ] = None,
    favourite: Annotated[
        bool, Query(description="Only the recordings you have marked as favourites.")
    ] = False,
) -> Filters:
    """Everything the filter bar sets that means the same in any library (``API-27``).

    ``transcription_state`` is repeatable and a union rather than the last one winning: four
    independent toggles with two ticked means *either*, not *the second* (``JOB-11b``).
    ``favourite`` is the caller's own marks and nobody else's, which is why it is a flag rather
    than an account to ask about.
    """
    return Filters(
        tag_slugs=tuple(tag or ()),
        recorded_from=recorded_from,
        recorded_to=recorded_to,
        min_duration_ms=min_duration_ms,
        max_duration_ms=max_duration_ms,
        transcription_states=tuple(transcription_state or ()),
        favourite_of=caller.id if favourite else None,
    )


ArchiveFilters = Annotated[Filters, Depends(archive_filters)]


def recording_filters(filters: ArchiveFilters, category_id: int | None = None) -> Filters:
    """Everything the filter bar sets, apart from which library it is looking at.

    The category is the one filter that is not in :func:`archive_filters`: it names a category
    inside one library, and across several it would mean nothing.
    """
    return replace(filters, category_id=category_id)


RecordingFilters = Annotated[Filters, Depends(recording_filters)]


def recording_sort(
    sort: SortField = SortField.RECORDED_AT,
    direction: SortDirection = SortDirection.DESCENDING,
) -> tuple[SortField, SortDirection]:
    """How the list is ordered, defaulting to the most recently recorded first."""
    return sort, direction


RecordingSort = Annotated[tuple[SortField, SortDirection], Depends(recording_sort)]
