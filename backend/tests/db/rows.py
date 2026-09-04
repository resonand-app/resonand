"""Minimal row factories for the schema tests.

They insert through raw SQL on purpose: these tests are about what the *database* refuses, so
going through the ORM would put a second thing between the assertion and the constraint. The
development seed with realistic content is ``DAT-8``, not this.
"""

from __future__ import annotations

from sonarium.core import colours
from sonarium.core.ids import new_uuid
from sonarium.core.time import now_instant
from sqlalchemy import Connection, text


def insert_user(connection: Connection, *, email: str = "reader@example.test") -> int:
    """A user, with ``email_normalised`` derived the way the application will derive it."""
    result = connection.execute(
        text(
            "INSERT INTO user (email, email_normalised, display_name, created_at) "
            "VALUES (:email, :normalised, :name, :now) RETURNING id"
        ),
        {
            "email": email,
            "normalised": email.strip().lower(),
            "name": email.split("@", maxsplit=1)[0],
            "now": now_instant(),
        },
    )
    return int(result.scalar_one())


def insert_library(
    connection: Connection,
    owner_id: int,
    *,
    name: str = "Archive",
    colour: str = colours.DEFAULT.value,
) -> int:
    result = connection.execute(
        text(
            "INSERT INTO library (uuid, owner_id, name, colour, created_at) "
            "VALUES (:uuid, :owner, :name, :colour, :now) RETURNING id"
        ),
        {
            "uuid": new_uuid(),
            "owner": owner_id,
            "name": name,
            "colour": colour,
            "now": now_instant(),
        },
    )
    return int(result.scalar_one())


def insert_category(
    connection: Connection,
    library_id: int,
    *,
    name: str = "Unit 1",
    parent_id: int | None = None,
) -> int:
    result = connection.execute(
        text(
            "INSERT INTO category (library_id, parent_id, name) "
            "VALUES (:library, :parent, :name) RETURNING id"
        ),
        {"library": library_id, "parent": parent_id, "name": name},
    )
    return int(result.scalar_one())


def insert_audio(
    connection: Connection,
    library_id: int,
    uploaded_by: int,
    *,
    title: str = "Untitled recording",
    notes: str | None = None,
    category_id: int | None = None,
) -> int:
    result = connection.execute(
        text(
            "INSERT INTO audio (uuid, library_id, category_id, uploaded_by, title, notes, "
            "storage_path, created_at) "
            "VALUES (:uuid, :library, :category, :uploader, :title, :notes, :path, :now) "
            "RETURNING id"
        ),
        {
            "uuid": new_uuid(),
            "library": library_id,
            "category": category_id,
            "uploader": uploaded_by,
            "title": title,
            "notes": notes,
            "path": "storage/ab/abcdef/original.m4a",
            "now": now_instant(),
        },
    )
    return int(result.scalar_one())


def insert_tag(connection: Connection, audio_id: int, name: str, slug: str) -> int:
    """A tag and its link to one recording, which is how the projection ever has a third part."""
    tag_id = int(
        connection.execute(
            text("INSERT INTO tag (name, slug) VALUES (:name, :slug) RETURNING id"),
            {"name": name, "slug": slug},
        ).scalar_one()
    )
    connection.execute(
        text("INSERT INTO audio_tag (audio_id, tag_id) VALUES (:audio, :tag)"),
        {"audio": audio_id, "tag": tag_id},
    )
    return tag_id


def insert_transcript(connection: Connection, audio_id: int, *, is_active: int = 1) -> int:
    result = connection.execute(
        text(
            "INSERT INTO transcript (audio_id, is_active, source, created_at) "
            "VALUES (:audio, :active, 'service', :now) RETURNING id"
        ),
        {"audio": audio_id, "active": is_active, "now": now_instant()},
    )
    return int(result.scalar_one())


def insert_segment(
    connection: Connection, transcript_id: int, idx: int, body: str, *, start_ms: int = 0
) -> int:
    result = connection.execute(
        text(
            "INSERT INTO segment (transcript_id, idx, start_ms, end_ms, text) "
            "VALUES (:transcript, :idx, :start, :end, :text) RETURNING id"
        ),
        {
            "transcript": transcript_id,
            "idx": idx,
            "start": start_ms,
            "end": start_ms + 1000,
            "text": body,
        },
    )
    return int(result.scalar_one())
