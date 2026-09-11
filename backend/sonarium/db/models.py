"""Typed declarative models, mirroring the first migration.

The migration is the source of truth for the schema, not this file: partial unique indexes, the
composite foreign key on ``audio`` and the FTS5 virtual tables are written as explicit DDL there
because Alembic cannot render any of them. These models exist so the rest of the backend has
typed access to the same tables, and ``tests/db/test_models_match_migration.py`` asserts the two
descriptions of the schema agree -- which is the only thing that keeps a hand-written migration
and a hand-written model file from drifting apart.

Two things a reader will look for and not find:

* **The FTS5 tables have no model.** They are virtual tables with no stable column shape a mapper
  could describe; ``sonarium.db.search_index`` writes them through SQL.
* **No relationships.** They belong with the repositories that need them (``DAT-4``), not here.

Timestamps follow ``DEC-11``: every instant column defaults to :func:`now_instant`, so the
convention holds from the first row written rather than from the first place somebody remembers
it. ``audio.recorded_at`` is the exception on purpose -- it is a wall-clock reading, it has no
sensible default, and its offset lives apart in ``recorded_at_offset``.
"""

from __future__ import annotations

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    LargeBinary,
    MetaData,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from sonarium.core import colours
from sonarium.core.ids import new_uuid
from sonarium.core.time import now_instant

__all__ = [
    "METADATA",
    "ApiToken",
    "Audio",
    "AudioTag",
    "Base",
    "Category",
    "Job",
    "Library",
    "Segment",
    "Session",
    "Share",
    "Tag",
    "Transcript",
    "User",
]


class Base(DeclarativeBase):
    """Declarative base for every table the migration creates."""


METADATA: MetaData = Base.metadata


class User(Base):
    """An account.

    ``email`` is the address as typed, kept for display and deliberately **not** unique;
    ``email_normalised`` is the key (``DEC-15``). Unique on the typed form would make
    ``Gabriel@x.com`` and ``gabriel@x.com`` two accounts.
    """

    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    email_normalised: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)
    """``NULL`` for an account that only ever signs in through OIDC."""

    oidc_subject: Mapped[str | None] = mapped_column(Text, unique=True)
    is_admin: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))

    language: Mapped[str | None] = mapped_column(Text)
    """``DEC-8``: a BCP 47 tag, ``NULL`` meaning follow the instance default, read by ``API-13``.
    Theme is deliberately not stored: it is per-device and lives in browser storage."""
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    disabled_at: Mapped[str | None] = mapped_column(Text)
    """A user with content cannot be deleted in v0, so disabling is the only exit."""


class Session(Base):
    """A live sign-in (``DEC-12``).

    The cookie carries a random secret and nothing else; only its hash is stored, so a stolen
    database cannot be replayed as cookies. Lookup is therefore by ``token_hash``, which is why
    that column is unique rather than merely indexed.
    """

    __tablename__ = "session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    last_seen_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    user_agent: Mapped[str | None] = mapped_column(Text)
    ip: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[str] = mapped_column(Text, nullable=False)
    revoked_at: Mapped[str | None] = mapped_column(Text)
    """Set, never deleted: the profile view lists what was signed out and when (``UI-20``)."""


class Library(Base):
    """The unit of ownership and of permissions. An audio belongs to exactly one."""

    __tablename__ = "library"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uuid: Mapped[str] = mapped_column(Text, nullable=False, unique=True, default=new_uuid)
    """``DEC-14``: the public identifier. Sequential ids in a URL are enumerable."""

    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_personal: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    """Created with the user and non-deletable, so ``audio.library_id`` is always populated."""

    colour: Mapped[str] = mapped_column(
        Text, nullable=False, server_default=text("'stone'"), default=colours.DEFAULT.value
    )
    """``DEC-8``: one of ``sonarium.core.colours.Colour``, chosen by the user and never derived.
    A ``CHECK`` in the schema keeps the set closed."""

    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    deleted_at: Mapped[str | None] = mapped_column(Text)
    """Deleting a library is trash too: the ACL hides it without touching a single audio row."""


class Category(Base):
    """A node in one library's taxonomy tree. An audio has at most one."""

    __tablename__ = "category"
    __table_args__ = (
        UniqueConstraint("id", "library_id", name="ux_category_id_library"),
        # Required by audio's composite foreign key: SQLite will only point one at a unique key.
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    library_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("library.id", ondelete="CASCADE"), nullable=False
    )
    parent_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("category.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))


class Audio(Base):
    """A recording: one intact original, an optional derivative, and its metadata."""

    __tablename__ = "audio"
    __table_args__ = (
        ForeignKeyConstraint(
            ["category_id", "library_id"],
            ["category.id", "category.library_id"],
            ondelete="SET NULL",
            name="fk_audio_category_in_same_library",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    uuid: Mapped[str] = mapped_column(Text, nullable=False, unique=True, default=new_uuid)
    library_id: Mapped[int] = mapped_column(Integer, ForeignKey("library.id"), nullable=False)
    category_id: Mapped[int | None] = mapped_column(Integer)
    """Reachable only through the composite key above, which pins it to this audio's library."""

    uploaded_by: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)
    """Attribution only. Ownership lives on the library, so a collaborator's upload is clear."""

    title: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[str | None] = mapped_column(Text)
    """A wall-clock reading, rendered as written and never converted (``DEC-11``)."""

    recorded_at_offset: Mapped[int | None] = mapped_column(Integer)
    """Minutes east of UTC when the offset is genuinely known, ``NULL`` when it is not."""

    recorded_at_source: Mapped[str | None] = mapped_column(Text)
    """``container`` | ``filename`` | ``filesystem``, whichever won (``ING-12``)."""

    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    deleted_at: Mapped[str | None] = mapped_column(Text)

    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    derived_path: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str | None] = mapped_column(Text)
    mime: Mapped[str | None] = mapped_column(Text)
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    sha256: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    sample_rate: Mapped[int | None] = mapped_column(Integer)
    channels: Mapped[int | None] = mapped_column(Integer)
    codec: Mapped[str | None] = mapped_column(Text)
    waveform: Mapped[bytes | None] = mapped_column(LargeBinary)
    """Peaks as a compact blob, not JSON: this is the product's thumbnail (``DEC-19``)."""


class Share(Base):
    """One grant, of one level, over either a library or a single audio -- never both."""

    __tablename__ = "share"
    __table_args__ = (
        CheckConstraint("level IN (10, 20, 30)", name="ck_share_level"),
        CheckConstraint("(library_id IS NULL) <> (audio_id IS NULL)", name="ck_share_one_target"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    library_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("library.id", ondelete="CASCADE")
    )
    audio_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("audio.id", ondelete="CASCADE")
    )
    """Individual sharing has no interface in v0; the resolution is in place from day one."""

    grantee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    granted_by: Mapped[int] = mapped_column(Integer, ForeignKey("user.id"), nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)


class Tag(Base):
    """An instance-global label. The first writer owns ``name``; ``slug`` is the key."""

    __tablename__ = "tag"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(Text, nullable=False, unique=True)


class AudioTag(Base):
    """Which tags are on which recording, and who put them there."""

    __tablename__ = "audio_tag"

    audio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("audio.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tag.id", ondelete="CASCADE"), primary_key=True
    )
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'user'"))
    """``user`` or ``llm``. Kept while suggestion storage is deferred (``DEC-1``)."""


class Transcript(Base):
    """One attempt at transcribing one recording. Several per audio; one of them active."""

    __tablename__ = "transcript"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    audio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("audio.id", ondelete="CASCADE"), nullable=False
    )
    is_active: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    source: Mapped[str] = mapped_column(Text, nullable=False)
    """``service``, ``manual`` or ``imported``."""

    provider: Mapped[str | None] = mapped_column(Text)
    model: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    edited_at: Mapped[str | None] = mapped_column(Text)
    derived_from: Mapped[int | None] = mapped_column(Integer, ForeignKey("transcript.id"))
    """The transcript a manual edit was made from, which is kept. Unread in v0, stored anyway."""


class Segment(Base):
    """A timed span of one transcript. Text, subtitles and highlighting all derive from these."""

    __tablename__ = "segment"
    __table_args__ = (UniqueConstraint("transcript_id", "idx", name="ux_segment_order"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("transcript.id", ondelete="CASCADE"), nullable=False
    )
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    start_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    end_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str | None] = mapped_column(Text)
    """Reserved for diarisation, unimplemented. Present so adding it costs no migration."""

    text: Mapped[str] = mapped_column(Text, nullable=False)


class Job(Base):
    """A unit of background work: probe, waveform, transcode, transcribe."""

    __tablename__ = "job"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    audio_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("audio.id", ondelete="CASCADE")
    )
    state: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'pending'"))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    idempotency_key: Mapped[str | None] = mapped_column(Text, unique=True)
    """Unique so a retry cannot duplicate work already queued."""

    external_id: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
    started_at: Mapped[str | None] = mapped_column(Text)
    finished_at: Mapped[str | None] = mapped_column(Text)


class ApiToken(Base):
    """A personal access token. Nothing in v0 issues or reads one; the table ships anyway."""

    __tablename__ = "api_token"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    scopes: Mapped[str] = mapped_column(Text, nullable=False)
    library_scope: Mapped[str | None] = mapped_column(Text)
    expires_at: Mapped[str | None] = mapped_column(Text)
    last_used_at: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(Text, nullable=False, default=now_instant)
