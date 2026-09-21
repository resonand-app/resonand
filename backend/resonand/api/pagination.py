"""Pagination, in one shape for every collection (``API-1``).

Offset and limit, with a total, rather than an opaque cursor. Two reasons: the archive is one
SQLite file where ``COUNT`` over an ACL-filtered set is cheap at the scale this is built for, and
the interface needs the total anyway -- a library header shows the number of recordings, and the
dense list (``UI-7``) is virtualised, which means it has to know how tall the list is before it
has fetched it.

A cursor becomes the right answer if a single library ever holds enough recordings for the count
to hurt. The envelope is shaped so that adding one is an additive change to the response rather
than a different response.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any

from fastapi import Query
from pydantic import BaseModel, Field
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@dataclass(frozen=True, slots=True)
class PageRequest:
    """What the caller asked for, already validated."""

    limit: int
    offset: int


def page_request(
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PageRequest:
    """The dependency every collection endpoint takes."""
    return PageRequest(limit=limit, offset=offset)


class Page[ItemType](BaseModel):
    """A slice of a collection, plus what the caller needs to ask for the next one."""

    items: list[ItemType]
    total: int = Field(ge=0, description="How many rows match, ignoring limit and offset.")
    limit: int = Field(ge=1, le=MAX_LIMIT)
    offset: int = Field(ge=0)

    @property
    def has_more(self) -> bool:
        """Whether another request would return anything."""
        return self.offset + len(self.items) < self.total


def page_of[ItemType](items: list[ItemType], *, total: int, request: PageRequest) -> Page[ItemType]:
    """Wrap a query's rows in the envelope, so no endpoint assembles it by hand."""
    return Page(items=items, total=total, limit=request.limit, offset=request.offset)


def count_of(session: Session, query: Select[Any]) -> int:
    """How many rows the query matches, asked of the database rather than counted in Python.

    The reasoning at the top of this module -- that ``COUNT`` over an ACL-filtered set is cheap at
    this scale -- is only true of a ``COUNT``. Every collection endpoint used to build the whole
    result set as ORM objects and take its length, which at the "hundreds of hours" scale the
    project is designed for is what reads on screen as *the grid got slow* (``REV-2``).

    The row type is unconstrained because the count discards the columns: every caller passes a
    ``Select`` of its own shape, and ``Select`` is invariant in that parameter.
    """
    return int(session.execute(select(func.count()).select_from(query.subquery())).scalar_one())
