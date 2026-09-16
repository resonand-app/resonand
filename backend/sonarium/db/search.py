"""Search (``JOB-10``, ``JOB-11``, ``JOB-14``).

The product's flagship feature and the sentence the whole project rests on: *you type* factory
*and you are there in three seconds.*

**One ranked list over both indexes.** Transcripts and metadata -- titles, notes, tag names --
are separate FTS5 tables for good reasons (one is external content over ``segment``, the other is
a projection across three tables), and the interface must not care. They are ranked together with
the same function, so a recording whose title is *The factory* and one that says "factory" in the
middle can be compared.

**The ACL is inside the query.** Not applied afterwards to a list of results, which would either
leak the existence of matches through the result count or require fetching everything to filter
it. The test that matters is that a user does not find transcript text they may not read.

**Matches are grouped under their recording** (``DEC-4``). A flat list lets one long interview
bury everything else -- forty matches in a two-hour recording would be the entire first page.

**The grouping, the ranking, the counting and the paging are all the database's** -- which is what
makes the answer the whole answer. Grouping in Python needs the matches in Python, and needing
them in Python needs a ceiling on how many are fetched; a ceiling on an unordered compound select
decides *which* results exist by whatever order SQLite happened to produce, applies the filters to
the survivors, and counts what is left as though it were the total. The only bound now is the
page: the fragments are built for the recordings somebody is looking at and no others.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

from sqlalchemy import Integer, and_, column, func, literal, or_, select, table, text
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from sonarium.acl.query import audio_acl
from sonarium.core.levels import Level
from sonarium.core.states import TranscriptionState
from sonarium.db.models import Audio, Job, Segment, Transcript
from sonarium.jobs import queue

MATCH_TRANSCRIPT = "transcript"
MATCH_METADATA = "metadata"

SHOWN_PER_RECORDING = 3
"""``DEC-4``: three matches visible, the rest behind "+N more"."""

_segment_fts = table("segment_fts", column("rowid"), column("text"))
_audio_fts = table("audio_fts", column("rowid"), column("title"), column("notes"), column("tags"))

_FTS_SPECIAL = re.compile(r'["*():^-]')
_TOKEN = re.compile(r"\S+")


@dataclass(frozen=True, slots=True)
class Match:
    """One place a query matched inside one recording."""

    kind: str
    fragment: str
    start_ms: int | None
    """Where to play from. ``None`` for a metadata match, which has no moment."""

    rank: float


@dataclass(frozen=True, slots=True)
class Hit:
    """A recording, with its matches grouped under it."""

    audio: Audio
    level: Level
    matches: tuple[Match, ...]
    total_matches: int

    @property
    def best_rank(self) -> float:
        return min((match.rank for match in self.matches), default=0.0)


class SortField(StrEnum):
    """What a list of recordings can be ordered by (``API-10``).

    Four, and deliberately not every column: these are the ones ``UI-7d`` offers, and a sort
    nobody can reach from the interface is a query somebody can make expensive for no benefit.
    """

    RECORDED_AT = "recorded_at"
    CREATED_AT = "created_at"
    DURATION_MS = "duration_ms"
    TITLE = "title"


class SortDirection(StrEnum):
    ASCENDING = "asc"
    DESCENDING = "desc"


@dataclass(frozen=True, slots=True)
class Filters:
    """What ``JOB-11`` narrows a search by."""

    library_uuid: str | None = None
    category_id: int | None = None
    tag_slugs: tuple[str, ...] = ()
    recorded_from: str | None = None
    recorded_to: str | None = None
    min_duration_ms: int | None = None
    max_duration_ms: int | None = None
    transcription_states: tuple[TranscriptionState, ...] = ()
    """The state toggles on the grid and in search, expressed as a filter.

    A **set**, not a choice: the interface draws four independent toggles, so two of them ticked
    has to mean *either*. Empty means no state filter at all, which is not the same as all four
    ticked only in that it is cheaper.
    """


def build_match_query(raw: str) -> str:
    """Turn what somebody typed into an FTS5 query.

    Two things happen here and both are deliberate. The FTS5 operators are stripped, because
    somebody searching for ``NOT`` or a hyphenated name is searching for words, not writing a
    query language -- and an unescaped one is a syntax error thrown at a person who typed a name.

    A **prefix wildcard is appended to the last token** (``JOB-14``). That is what makes the
    search feel live while it is being typed, and it is what turns *factor* into *factory*. It is
    not stemming and it does not pretend to be: see :func:`recall_note`.
    """
    cleaned = _FTS_SPECIAL.sub(" ", raw).strip()
    tokens = _TOKEN.findall(cleaned)
    if not tokens:
        return ""
    quoted = [f'"{token}"' for token in tokens[:-1]]
    quoted.append(f'"{tokens[-1]}"*')
    return " ".join(quoted)


def recall_note() -> str:
    """What this search does and does not find, in words the interface can show.

    ``JOB-14`` is a decision to take rather than to discover. Taken: accent-insensitive matching
    (``unicode61 remove_diacritics 2``) plus a prefix wildcard on the final token, and **no
    stemming**. A trigram index would find *fabriques* from *fabrica* at roughly three times the
    index size and a slower write path on every segment; it is the right change to make when the
    measurement says it is needed, and the measurement lives in the recall fixture in the tests
    rather than in anybody's memory.
    """
    return (
        "Search ignores accents and matches the start of the last word you type. "
        "It does not know that words are related: searching for one form of a word will not "
        "find its other forms."
    )


def search(
    session: Session,
    user_id: int,
    query: str,
    *,
    filters: Filters | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Hit], int]:
    """Search the whole archive. Returns the page of recordings and how many matched.

    Three queries, and each one answers a question the others cannot:

    1. how many recordings match, which is the number the interface shows and pages against;
    2. which of them belong on this page, ranked and narrowed by the filters;
    3. the handful of matches to show under each recording *on this page* -- and only those,
       because the other ninety-nine pages' fragments are work nobody asked for.

    The page is decided in the database rather than by slicing a list, so asking for the tenth
    page costs what asking for the first costs, and a filter narrows what is counted rather than
    what happens to have been fetched.
    """
    match = build_match_query(query)
    if not match:
        return [], 0
    # Resolved once and threaded through both halves. Two calls would build two CTEs with the
    # same name, which is a compile error now that they meet inside one statement.
    acl = audio_acl(user_id)
    matches = _match_rows(match, _readable(acl))
    candidates = _candidates(matches, acl, filters or Filters())

    total = int(
        session.execute(select(func.count()).select_from(candidates.subquery())).scalar_one()
    )
    if not total:
        return [], 0

    page = session.execute(candidates.limit(limit).offset(offset)).all()
    shown = _matches_for(session, matches, [row[0].id for row in page])
    return [
        Hit(
            audio=audio,
            level=Level(level),
            matches=shown.get(audio.id, ()),
            total_matches=int(total_matches),
        )
        for audio, level, _best, total_matches in page
    ], total


def _readable(acl: Any) -> Any:
    """The recordings this user may read, as a subquery the search can sit inside."""
    return select(acl.c.audio_id).where(acl.c.level >= int(Level.READ))


def _transcript_matches(match: str, readable: Any) -> Any:
    """Matches inside the active transcript, with the moment to play from."""
    return (
        select(
            Transcript.audio_id.label("audio_id"),
            literal(MATCH_TRANSCRIPT).label("kind"),
            func.snippet(text("segment_fts"), 0, "<mark>", "</mark>", "...", 24).label("fragment"),
            Segment.start_ms.label("start_ms"),
            func.bm25(text("segment_fts")).label("rank"),
        )
        .select_from(_segment_fts)
        .join(Segment, Segment.id == _segment_fts.c.rowid)
        .join(Transcript, (Transcript.id == Segment.transcript_id) & (Transcript.is_active == 1))
        .where(text("segment_fts MATCH :match").bindparams(match=match))
        .where(Transcript.audio_id.in_(readable))
    )


def _metadata_matches(match: str, readable: Any) -> Any:
    """Matches in a title, in notes or in a tag name (``DEC-13``)."""
    return (
        select(
            _audio_fts.c.rowid.cast(Integer).label("audio_id"),
            literal(MATCH_METADATA).label("kind"),
            func.snippet(text("audio_fts"), -1, "<mark>", "</mark>", "...", 24).label("fragment"),
            literal(None).label("start_ms"),
            func.bm25(text("audio_fts")).label("rank"),
        )
        .select_from(_audio_fts)
        .where(text("audio_fts MATCH :match").bindparams(match=match))
        .where(_audio_fts.c.rowid.in_(readable))
    )


def _match_rows(match: str, readable: Any) -> Any:
    """Every match from both indexes, as one thing the queries below can sit on.

    A recording can match in both -- a title *and* a line of its transcript -- so the two halves
    are unioned rather than merged afterwards, and the grouping below is what stops that showing
    up as the same recording listed twice.
    """
    return (
        _transcript_matches(match, readable)
        .union_all(_metadata_matches(match, readable))
        .subquery("matches")
    )


def _candidates(matches: Any, acl: Any, filters: Filters) -> Any:
    """The recordings that matched, ranked best first, with the filters applied.

    ``bm25`` scores better as it gets more negative, so the best match a recording has is the
    *minimum* over its rows and ascending order is the right way round. ``Audio.id`` breaks the
    tie, because two recordings with identical scores and no defined order between them is a row
    that appears on two pages while somebody scrolls.
    """
    ranked = (
        select(
            matches.c.audio_id.label("audio_id"),
            func.min(matches.c.rank).label("best_rank"),
            func.count().label("total_matches"),
        )
        .group_by(matches.c.audio_id)
        .subquery("ranked")
    )
    query = (
        select(Audio, acl.c.level, ranked.c.best_rank, ranked.c.total_matches)
        .join(acl, acl.c.audio_id == Audio.id)
        .join(ranked, ranked.c.audio_id == Audio.id)
    )
    return apply_filters(query, filters).order_by(ranked.c.best_rank, Audio.id)


def _matches_for(
    session: Session, matches: Any, audio_ids: Sequence[int]
) -> dict[int, tuple[Match, ...]]:
    """The few matches shown under each recording on this page (``DEC-4``).

    Asked for the page's recordings only. The fragments are the expensive part of a match -- each
    one is ``snippet()`` reading the indexed text -- and every recording the caller has not
    scrolled to is a fragment nobody will read.
    """
    if not audio_ids:
        return {}
    rows = session.execute(
        select(
            matches.c.audio_id,
            matches.c.kind,
            matches.c.fragment,
            matches.c.start_ms,
            matches.c.rank,
        )
        .where(matches.c.audio_id.in_(audio_ids))
        .order_by(matches.c.audio_id, matches.c.rank, matches.c.start_ms)
    ).all()

    collected: dict[int, list[Match]] = {}
    for row in rows:
        under = collected.setdefault(int(row.audio_id), [])
        if len(under) < SHOWN_PER_RECORDING:
            under.append(
                Match(
                    kind=str(row.kind),
                    fragment=str(row.fragment or ""),
                    start_ms=int(row.start_ms) if row.start_ms is not None else None,
                    rank=float(row.rank or 0.0),
                )
            )
    return {audio_id: tuple(found) for audio_id, found in collected.items()}


def apply_filters(query: Any, filters: Filters) -> Any:
    """Narrow a recording query (``JOB-11``).

    Shared with the library grid, so a filter behaves identically whether it is applied to a
    search or to a listing -- which is what stops "has no transcript" meaning two different
    things in two places.
    """
    from sonarium.db.models import AudioTag, Library, Tag  # noqa: PLC0415 -- narrow, avoids a cycle

    if filters.library_uuid:
        query = query.where(
            Audio.library_id.in_(select(Library.id).where(Library.uuid == filters.library_uuid))
        )
    if filters.category_id is not None:
        query = query.where(Audio.category_id == filters.category_id)
    for slug in filters.tag_slugs:
        query = query.where(
            Audio.id.in_(
                select(AudioTag.audio_id)
                .join(Tag, Tag.id == AudioTag.tag_id)
                .where(Tag.slug == slug)
            )
        )
    if filters.recorded_from:
        query = query.where(Audio.recorded_at >= filters.recorded_from)
    if filters.recorded_to:
        query = query.where(Audio.recorded_at <= filters.recorded_to)
    if filters.min_duration_ms is not None:
        query = query.where(Audio.duration_ms >= filters.min_duration_ms)
    if filters.max_duration_ms is not None:
        query = query.where(Audio.duration_ms <= filters.max_duration_ms)
    if filters.transcription_states:
        query = query.where(
            or_(*(_state_predicate(state) for state in set(filters.transcription_states)))
        )
    return query


def _state_predicate(state: TranscriptionState) -> ColumnElement[bool]:
    """One of the four states, as a condition on ``audio``.

    This has to answer exactly what :func:`sonarium.api.presenters.transcription_state` answers,
    including its precedence -- a transcript wins over a failed job, and a *pending* job reads as
    running. If it did not, a card would carry one badge and the toggle meant to select it would
    not find it.
    """
    transcribed = Audio.id.in_(select(Transcript.audio_id).where(Transcript.is_active == 1))
    busy = Audio.id.in_(
        select(Job.audio_id).where(
            Job.kind == queue.KIND_TRANSCRIBE, Job.state.in_((queue.PENDING, queue.RUNNING))
        )
    )
    failed = Audio.id.in_(
        select(Job.audio_id).where(Job.kind == queue.KIND_TRANSCRIBE, Job.state == queue.FAILED)
    )
    match state:
        case TranscriptionState.DONE:
            return transcribed
        case TranscriptionState.RUNNING:
            return and_(~transcribed, busy)
        case TranscriptionState.FAILED:
            return and_(~transcribed, ~busy, failed)
        case TranscriptionState.NONE:
            return and_(~transcribed, ~busy, ~failed)
