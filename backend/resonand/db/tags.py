"""Tags (``DAT-6``).

The vocabulary is **instance-global**, because a per-library one fragments and ends up holding
five spellings of the same word. That decision creates two problems, and this module is where
both are solved:

**The first writer owns the display name.** ``slug`` is the unique key and ``name`` is what gets
shown. Somebody typing *Fisica* against an existing *fisica* lands on the existing tag rather
than silently renaming it for everybody else -- and autocomplete offers the canonical spelling, so
the situation mostly does not arise.

**Autocomplete is filtered by the ACL.** A global vocabulary with an unfiltered suggestion list
would leak tag names between accounts: type two letters and learn what the other people on the
instance have been recording. Suggestions therefore come only from tags that appear on recordings
the caller can read, which is a join through the ACL rather than a query against ``tag``.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from resonand.acl.query import audio_acl
from resonand.core.errors import InvalidRequestError
from resonand.core.levels import Level
from resonand.core.text import normalise_slug
from resonand.db import search_index
from resonand.db.models import Audio, AudioTag, Tag

SUGGESTION_LIMIT = 10


def resolve_tag(session: Session, name: str) -> Tag:
    """Find the tag this name refers to, creating it if nobody has used it yet."""
    cleaned = " ".join(name.split())
    slug = normalise_slug(cleaned)
    if not slug:
        raise InvalidRequestError(f"{name!r} cannot be used as a tag.")
    existing = session.execute(select(Tag).where(Tag.slug == slug)).scalar_one_or_none()
    if existing is not None:
        return existing
    tag = Tag(name=cleaned, slug=slug)
    session.add(tag)
    session.flush()
    return tag


def set_audio_tags(session: Session, audio_id: int, names: list[str]) -> list[Tag]:
    """Replace a recording's tags with exactly this set.

    Replacing rather than adding is what makes the interface's "these are the tags" panel honest:
    a caller that sends a list gets that list, and removing one does not need its own endpoint.

    The search index is updated here rather than by the caller. Tag names are a third of the
    metadata projection, so a tag set without a reindex is a tag nobody can search for -- and
    making that the caller's job is making it something a caller can forget.
    """
    tags = [resolve_tag(session, name) for name in names]
    wanted = {tag.id for tag in tags}
    current = set(
        session.execute(select(AudioTag.tag_id).where(AudioTag.audio_id == audio_id))
        .scalars()
        .all()
    )
    for tag_id in current - wanted:
        link = session.get(AudioTag, {"audio_id": audio_id, "tag_id": tag_id})
        if link is not None:
            session.delete(link)
    for tag_id in wanted - current:
        session.add(AudioTag(audio_id=audio_id, tag_id=tag_id, source="user"))
    session.flush()
    search_index.index_audio(session, audio_id)
    return tags


def tags_for_audio(session: Session, audio_id: int) -> list[Tag]:
    """A recording's tags, in a stable order so the interface does not reshuffle them."""
    return list(
        session.execute(
            select(Tag)
            .join(AudioTag, AudioTag.tag_id == Tag.id)
            .where(AudioTag.audio_id == audio_id)
            .order_by(Tag.name)
        )
        .scalars()
        .all()
    )


def tags_for_audios(session: Session, audio_ids: list[int]) -> dict[int, list[Tag]]:
    """Tags for many recordings at once, so a grid of eighty cards is one query rather than
    eighty."""
    if not audio_ids:
        return {}
    rows = session.execute(
        select(AudioTag.audio_id, Tag)
        .join(Tag, Tag.id == AudioTag.tag_id)
        .where(AudioTag.audio_id.in_(audio_ids))
        .order_by(Tag.name)
    ).all()
    grouped: dict[int, list[Tag]] = {audio_id: [] for audio_id in audio_ids}
    for audio_id, tag in rows:
        grouped[int(audio_id)].append(tag)
    return grouped


def suggest_tags(
    session: Session, user_id: int, prefix: str = "", limit: int = SUGGESTION_LIMIT
) -> list[tuple[Tag, int]]:
    """Tags the caller could plausibly mean, with how many of their recordings carry each.

    Only tags on recordings this user can read. Anything else would turn autocomplete into a
    directory of what everybody else on the instance records.
    """
    acl = audio_acl(user_id)
    query = (
        select(Tag, func.count(AudioTag.audio_id).label("uses"))
        .join(AudioTag, AudioTag.tag_id == Tag.id)
        .join(Audio, Audio.id == AudioTag.audio_id)
        .join(acl, acl.c.audio_id == Audio.id)
        .where(acl.c.level >= int(Level.READ))
        .group_by(Tag.id)
        .order_by(func.count(AudioTag.audio_id).desc(), Tag.name)
        .limit(limit)
    )
    slug_prefix = normalise_slug(prefix)
    if slug_prefix:
        query = query.where(Tag.slug.like(f"{slug_prefix}%"))
    return [(row[0], int(row[1])) for row in session.execute(query).all()]
