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
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy import Integer, column, func, literal, select, table, text
from sqlalchemy.orm import Session

from sonarium.acl.query import audio_acl
from sonarium.core.levels import Level
from sonarium.db.models import Audio, Segment, Transcript

MATCH_TRANSCRIPT = "transcript"
MATCH_METADATA = "metadata"

SHOWN_PER_RECORDING = 3
"""``DEC-4``: three matches visible, the rest behind "+N more"."""

MAX_MATCHES_SCANNED = 500
"""A ceiling on how much of a very common word's results are pulled back to be grouped.

Grouping happens here rather than in SQL because the two indexes rank separately and a
recording can match in both; the ceiling is what keeps that from being unbounded when
somebody searches for a word that appears in every recording they own."""

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
    transcription_state: str | None = None
    """``none`` | ``done`` -- the toggles on the grid, expressed as a search filter."""


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
    """Search the whole archive. Returns the page of recordings and how many matched."""
    match = build_match_query(query)
    if not match:
        return [], 0
    readable = _readable(user_id)
    # The cap goes on the union rather than on each half: SQLite refuses parenthesised terms
    # in a compound select, which is what a per-half LIMIT would force SQLAlchemy to emit.
    combined = _transcript_matches(match, readable).union_all(_metadata_matches(match, readable))
    rows = list(session.execute(combined.limit(MAX_MATCHES_SCANNED)).all())
    grouped = _group(session, rows, filters or Filters(), user_id)
    return grouped[offset : offset + limit], len(grouped)


def _readable(user_id: int) -> Any:
    """The recordings this user may read, as a subquery the search can sit inside."""
    acl = audio_acl(user_id)
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


def _group(session: Session, rows: list[Any], filters: Filters, user_id: int) -> list[Hit]:
    """Collect matches under their recording, best first."""
    by_audio: dict[int, list[Match]] = {}
    for row in rows:
        by_audio.setdefault(int(row.audio_id), []).append(
            Match(
                kind=str(row.kind),
                fragment=str(row.fragment or ""),
                start_ms=int(row.start_ms) if row.start_ms is not None else None,
                rank=float(row.rank or 0.0),
            )
        )
    if not by_audio:
        return []

    acl = audio_acl(user_id)
    query = (
        select(Audio, acl.c.level)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(Audio.id.in_(by_audio.keys()))
    )
    query = apply_filters(query, filters)

    hits: list[Hit] = []
    for audio, level in session.execute(query).all():
        matches = sorted(by_audio[audio.id], key=lambda entry: (entry.rank, entry.start_ms or 0))
        hits.append(
            Hit(
                audio=audio,
                level=Level(level),
                matches=tuple(matches[:SHOWN_PER_RECORDING]),
                total_matches=len(matches),
            )
        )
    hits.sort(key=lambda hit: hit.best_rank)
    return hits


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
    if filters.transcription_state == "done":
        query = query.where(
            Audio.id.in_(select(Transcript.audio_id).where(Transcript.is_active == 1))
        )
    elif filters.transcription_state == "none":
        query = query.where(
            Audio.id.not_in(select(Transcript.audio_id).where(Transcript.is_active == 1))
        )
    return query
