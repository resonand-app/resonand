"""Development fixtures (``DAT-8``).

One archive with every shape in it that the interface has to handle: libraries shared at all three
levels, recordings with a transcript and without one, a category tree, tags, and something in the
trash. It serves the tests, the interface's development against real data, and later the demo
instance -- which is why it lives in the package rather than in ``tests/``.

It is deliberately not random. A seed that shuffles produces screenshots that cannot be compared
and test failures that cannot be reproduced.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from sonarium.core.levels import Level
from sonarium.core.time import now_instant
from sonarium.db import categories, libraries, tags, transcripts, users
from sonarium.db.audio import create_audio
from sonarium.db.models import Audio, Library, User
from sonarium.db.transcripts import Origin, SegmentDraft

UNUSABLE_CREDENTIAL = "*"
"""No seeded account can be signed into.

Argon2 refuses to verify anything that is not a well-formed hash, so this value rejects every
password rather than accepting some particular one. A seed that shipped a working credential
is how a demo instance ends up being somebody's production login."""


@dataclass(frozen=True, slots=True)
class Seeded:
    """What the seed created, so a caller can talk about it."""

    owner: User
    collaborator: User
    reader: User
    shared: Library
    recordings: list[Audio]


def seed(session: Session) -> Seeded:
    """Populate an empty database. Returns what it made."""
    owner = users.create_user(
        session,
        email="owner@sonarium.test",
        display_name="Archive owner",
        password_hash=UNUSABLE_CREDENTIAL,
        is_admin=True,
    )
    collaborator = users.create_user(
        session,
        email="collaborator@sonarium.test",
        display_name="Collaborator",
        password_hash=UNUSABLE_CREDENTIAL,
    )
    reader = users.create_user(
        session,
        email="reader@sonarium.test",
        display_name="Reader",
        password_hash=UNUSABLE_CREDENTIAL,
    )

    shared = libraries.create_library(
        session,
        owner.id,
        name="Family",
        description="The recordings this whole thing exists for.",
    )
    libraries.share_library(
        session, owner.id, shared.uuid, grantee_id=collaborator.id, level=Level.EDIT
    )
    libraries.share_library(session, owner.id, shared.uuid, grantee_id=reader.id, level=Level.READ)

    village = categories.create_category(session, owner.id, shared.uuid, name="The village")
    categories.create_category(
        session, owner.id, shared.uuid, name="The factory", parent_id=village.id
    )

    made: list[Audio] = []

    transcribed = create_audio(
        session,
        library_id=shared.id,
        uploaded_by=owner.id,
        storage_path="storage/aa/aaaaaaaa/original.m4a",
        original_filename="Recording 2024-03-11 18.22.m4a",
        sha256="a" * 64,
        size_bytes=42_000_000,
    )
    transcribed.recorded_at = "2024-03-11T18:22:00"
    transcribed.recorded_at_offset = 60
    transcribed.duration_ms = 2_400_000
    transcribed.category_id = village.id
    tags.set_audio_tags(session, transcribed.id, ["family", "oral history"])
    transcripts.create_transcript(
        session,
        transcribed.id,
        [
            SegmentDraft(0, 4200, "She starts by talking about the village."),
            SegmentDraft(4200, 9100, "Then about the factory, and what it used to be like."),
            SegmentDraft(9100, 15000, "The part everybody in the family remembers."),
        ],
        Origin(provider="openai-compatible", model="whisper-1", language="en"),
    )
    made.append(transcribed)

    waiting = create_audio(
        session,
        library_id=shared.id,
        uploaded_by=collaborator.id,
        storage_path="storage/bb/bbbbbbbb/original.opus",
        original_filename="PTT-20240412-WA0007.opus",
        sha256="b" * 64,
        size_bytes=900_000,
    )
    waiting.recorded_at = "2024-04-12T09:05:00"
    waiting.duration_ms = 63_000
    tags.set_audio_tags(session, waiting.id, ["voice note"])
    made.append(waiting)

    personal = users.personal_library(session, owner.id)
    private = create_audio(
        session,
        library_id=personal.id,
        uploaded_by=owner.id,
        storage_path="storage/cc/cccccccc/original.m4a",
        original_filename="Thinking out loud while driving.m4a",
        sha256="c" * 64,
        size_bytes=15_000_000,
    )
    private.duration_ms = 1_800_000
    made.append(private)

    discarded = create_audio(
        session,
        library_id=shared.id,
        uploaded_by=owner.id,
        storage_path="storage/dd/dddddddd/original.wav",
        original_filename="Test recording, ignore.wav",
        sha256="d" * 64,
        size_bytes=1_000,
    )
    discarded.deleted_at = now_instant()
    made.append(discarded)

    session.flush()
    return Seeded(
        owner=owner, collaborator=collaborator, reader=reader, shared=shared, recordings=made
    )
