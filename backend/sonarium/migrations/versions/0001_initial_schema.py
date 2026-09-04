"""initial schema

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-02

The whole data model in one revision, written as explicit DDL rather than through Alembic's
operations, because partial unique indexes, the composite foreign key on ``audio`` and the FTS5
virtual tables cannot be rendered by ``op.create_table`` and would have had to be raw SQL anyway.
This file is the source of truth for the schema; ``sonarium.db.models`` mirrors it and a test
asserts the two agree.

It carries the specification's schema **plus the six deltas** listed under *What the first
migration contains* in ``docs/v0-plan.md``, each of which is expensive to add afterwards:

1. ``session`` (``DEC-12``) -- the cookie carries a random secret and nothing else, so the row is
   found by ``token_hash``, which is unique for that reason and not merely indexed. The partial
   index on ``user_id`` is what makes "sign out everywhere" one ``UPDATE`` (``API-3``).
2. ``audio_fts`` (``DEC-13``) -- search covers titles, notes and tags as well as transcripts, and
   ``LIKE '%x%'`` cannot use an index. Retrofitting this would mean reindexing the whole archive.
3. ``library.uuid`` (``DEC-14``) -- **only** ``library``. ``category`` and ``tag`` deliberately do
   not get one: they are reached only through a library the caller can already read, so a
   sequential id in their URL discloses nothing that the library's own permissions did not
   already. Adding a public identifier where it is not needed costs a column, an index and a
   lookup path on every request forever.
4. ``user.email_normalised UNIQUE`` (``DEC-15``) -- and note that ``user.email`` **loses** the
   specification's ``UNIQUE``. Keeping both would make ``Gabriel@x.com`` and ``gabriel@x.com`` two
   accounts, which is exactly the bug the delta exists to prevent.
5. ``audio.recorded_at_offset`` (``DEC-11``) -- nullable, in minutes. ``recorded_at`` is a
   wall-clock reading rendered as written; its offset is stored apart and only when it is genuinely
   known. Every other timestamp column is a fixed-width UTC instant.
6. ``library.colour`` (``DEC-8``) -- one of seven names, behind a ``CHECK``, defaulting to
   ``stone``. The design system identifies a library by a colour **the user picks**; deriving it
   from the ``uuid`` would save the column and quietly make the choice unchangeable, which is a
   different product decision taken by accident. The ``CHECK`` rather than free text is what keeps
   the set closed: a hex value in this column would put a colour outside the token system into the
   interface, which is the one thing the system forbids.

**The two FTS5 tables are kept in step differently, on purpose.**

``segment_fts`` is an external-content table over ``segment`` and is maintained by triggers, which
is the standard SQLite pattern for external content: the projection is one column of one row of one
table, so a trigger set is both complete and readable.

``audio_fts`` is a plain FTS5 table -- it stores its own copy, which is what lets ``snippet()``
return a fragment for a metadata match (``JOB-10`` needs one from both halves of the ranked list) --
and it is maintained by explicit writes from ``sonarium.db.search_index`` alone. Its projection
spans ``audio``, ``audio_tag`` and ``tag``: a trigger set over three tables, each with insert,
update and delete, is where this stops being reviewable, and it would still miss a tag renamed
under an audio nobody touched. ``JOB-9``'s ``sonarium reindex`` rebuilds both.

**One consequence worth knowing before it surprises somebody.** The composite foreign key is
declared ``ON DELETE SET NULL`` as the specification has it, and SQLite sets *all* the child
columns on that action -- including ``audio.library_id``, which is ``NOT NULL``. Deleting a
category that still has recordings in it therefore fails rather than orphaning them. The category
service has to clear the assignment first, which it should do anyway to control what the audio
ends up in.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


SCHEMA: tuple[str, ...] = (
    # --- Accounts and sessions --------------------------------------------
    """
    CREATE TABLE user (
      id               INTEGER PRIMARY KEY,
      email            TEXT NOT NULL,              -- as typed, for display; deliberately not unique
      email_normalised TEXT NOT NULL UNIQUE,       -- the key (DEC-15)
      display_name     TEXT NOT NULL,
      password_hash    TEXT,                       -- NULL if the account is OIDC-only
      oidc_subject     TEXT UNIQUE,                -- NULL if the account is local-only
      is_admin         INTEGER NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL,
      disabled_at      TEXT
    )
    """,
    """
    CREATE TABLE session (
      id           INTEGER PRIMARY KEY,
      user_id      INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      token_hash   TEXT NOT NULL UNIQUE,           -- the cookie's secret, hashed; the lookup key
      created_at   TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      user_agent   TEXT,
      ip           TEXT,
      expires_at   TEXT NOT NULL,
      revoked_at   TEXT
    )
    """,
    "CREATE INDEX ix_session_user_live ON session(user_id) WHERE revoked_at IS NULL",
    # --- Libraries, categories, recordings --------------------------------
    """
    CREATE TABLE library (
      id          INTEGER PRIMARY KEY,
      uuid        TEXT NOT NULL UNIQUE,            -- public identifier in URLs and the API
      owner_id    INTEGER NOT NULL REFERENCES user(id),
      name        TEXT NOT NULL,
      description TEXT,
      is_personal INTEGER NOT NULL DEFAULT 0,      -- created with the user, non-deletable
      colour      TEXT NOT NULL DEFAULT 'stone',   -- DEC-8: chosen by the user, never derived
      created_at  TEXT NOT NULL,
      deleted_at  TEXT,
      CHECK (colour IN ('amber','clay','slate','moss','stone','plum','teal'))
    )
    """,
    "CREATE INDEX ix_library_owner ON library(owner_id)",
    """
    CREATE TABLE category (
      id         INTEGER PRIMARY KEY,
      library_id INTEGER NOT NULL REFERENCES library(id) ON DELETE CASCADE,
      parent_id  INTEGER REFERENCES category(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      position   INTEGER NOT NULL DEFAULT 0,
      UNIQUE (id, library_id)                      -- required by the composite FK on audio
    )
    """,
    # SQLite treats NULLs as distinct, so one index over (library_id, parent_id, name) would let
    # two root categories share a name. Splitting it in two partial indexes is what closes that.
    "CREATE UNIQUE INDEX ux_cat_root  ON category(library_id, name) WHERE parent_id IS NULL",
    "CREATE UNIQUE INDEX ux_cat_child ON category(library_id, parent_id, name) WHERE parent_id IS NOT NULL",
    """
    CREATE TABLE audio (
      id            INTEGER PRIMARY KEY,
      uuid          TEXT NOT NULL UNIQUE,          -- public identifier in URLs and the API
      library_id    INTEGER NOT NULL REFERENCES library(id),
      category_id   INTEGER,
      uploaded_by   INTEGER NOT NULL REFERENCES user(id),

      title         TEXT NOT NULL,
      notes         TEXT,
      recorded_at   TEXT,                          -- wall clock, rendered as written (DEC-11)
      recorded_at_offset INTEGER,                  -- minutes east of UTC, NULL when unknown
      created_at    TEXT NOT NULL,
      deleted_at    TEXT,                          -- trash

      storage_path      TEXT NOT NULL,             -- original, intact
      derived_path      TEXT,                      -- Opus for browser playback
      original_filename TEXT,
      mime          TEXT,
      size_bytes    INTEGER,
      sha256        TEXT,                          -- duplicate detection at ingestion
      duration_ms   INTEGER,
      sample_rate   INTEGER,
      channels      INTEGER,
      codec         TEXT,
      waveform      BLOB,                          -- precomputed peaks

      -- guarantees that the category belongs to the SAME library as the audio
      FOREIGN KEY (category_id, library_id) REFERENCES category(id, library_id) ON DELETE SET NULL
    )
    """,
    "CREATE INDEX ix_audio_library ON audio(library_id) WHERE deleted_at IS NULL",
    "CREATE INDEX ix_audio_sha     ON audio(sha256)",
    # --- Sharing -----------------------------------------------------------
    """
    CREATE TABLE share (
      id         INTEGER PRIMARY KEY,
      library_id INTEGER REFERENCES library(id) ON DELETE CASCADE,
      audio_id   INTEGER REFERENCES audio(id)   ON DELETE CASCADE,
      grantee_id INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      level      INTEGER NOT NULL CHECK (level IN (10, 20, 30)),
      granted_by INTEGER NOT NULL REFERENCES user(id),
      created_at TEXT NOT NULL,
      CHECK ((library_id IS NULL) <> (audio_id IS NULL))   -- exactly one of the two
    )
    """,
    "CREATE UNIQUE INDEX ux_share_lib   ON share(library_id, grantee_id) WHERE library_id IS NOT NULL",
    "CREATE UNIQUE INDEX ux_share_audio ON share(audio_id, grantee_id)   WHERE audio_id   IS NOT NULL",
    # --- Tags --------------------------------------------------------------
    """
    CREATE TABLE tag (
      id   INTEGER PRIMARY KEY,
      name TEXT NOT NULL,                          -- the first writer's spelling
      slug TEXT NOT NULL UNIQUE                    -- normalised: lowercase, without diacritics
    )
    """,
    """
    CREATE TABLE audio_tag (
      audio_id INTEGER NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
      tag_id   INTEGER NOT NULL REFERENCES tag(id)   ON DELETE CASCADE,
      source   TEXT NOT NULL DEFAULT 'user',        -- 'user' | 'llm'
      PRIMARY KEY (audio_id, tag_id)
    )
    """,
    "CREATE INDEX ix_audiotag_tag ON audio_tag(tag_id)",
    # --- Transcripts -------------------------------------------------------
    """
    CREATE TABLE transcript (
      id           INTEGER PRIMARY KEY,
      audio_id     INTEGER NOT NULL REFERENCES audio(id) ON DELETE CASCADE,
      is_active    INTEGER NOT NULL DEFAULT 0,
      source       TEXT NOT NULL,                  -- 'service' | 'manual' | 'imported'
      provider     TEXT,
      model        TEXT,
      language     TEXT,
      created_at   TEXT NOT NULL,
      edited_at    TEXT,
      derived_from INTEGER REFERENCES transcript(id)   -- the original, if this is a manual edit
    )
    """,
    "CREATE UNIQUE INDEX ux_transcript_active ON transcript(audio_id) WHERE is_active = 1",
    """
    CREATE TABLE segment (
      id            INTEGER PRIMARY KEY,
      transcript_id INTEGER NOT NULL REFERENCES transcript(id) ON DELETE CASCADE,
      idx           INTEGER NOT NULL,
      start_ms      INTEGER NOT NULL,
      end_ms        INTEGER NOT NULL,
      speaker       TEXT,                          -- reserved for future diarisation
      text          TEXT NOT NULL,
      UNIQUE (transcript_id, idx)
    )
    """,
    # --- Search indexes ----------------------------------------------------
    """
    CREATE VIRTUAL TABLE segment_fts USING fts5(
      text, content='segment', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
    )
    """,
    """
    CREATE TRIGGER segment_fts_after_insert AFTER INSERT ON segment BEGIN
      INSERT INTO segment_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    """
    CREATE TRIGGER segment_fts_after_delete AFTER DELETE ON segment BEGIN
      INSERT INTO segment_fts(segment_fts, rowid, text) VALUES ('delete', old.id, old.text);
    END
    """,
    """
    CREATE TRIGGER segment_fts_after_update AFTER UPDATE ON segment BEGIN
      INSERT INTO segment_fts(segment_fts, rowid, text) VALUES ('delete', old.id, old.text);
      INSERT INTO segment_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    # A plain table, not external content: it keeps its own copy of the projection, which is what
    # makes snippet() work for a metadata match. rowid is audio.id. Written only by
    # sonarium.db.search_index -- see the note at the top of this file.
    """
    CREATE VIRTUAL TABLE audio_fts USING fts5(
      title, notes, tags, tokenize='unicode61 remove_diacritics 2'
    )
    """,
    # --- Jobs and tokens ---------------------------------------------------
    """
    CREATE TABLE job (
      id              INTEGER PRIMARY KEY,
      kind            TEXT NOT NULL,               -- 'probe' | 'waveform' | 'transcode' | 'transcribe'
      audio_id        INTEGER REFERENCES audio(id) ON DELETE CASCADE,
      state           TEXT NOT NULL DEFAULT 'pending',  -- pending|running|done|failed|cancelled
      attempts        INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT UNIQUE,                 -- so a retry does not duplicate work
      external_id     TEXT,                        -- the job id on the external service
      payload         TEXT,                        -- JSON
      error           TEXT,
      created_at      TEXT NOT NULL,
      started_at      TEXT,
      finished_at     TEXT
    )
    """,
    "CREATE INDEX ix_job_pending ON job(state, created_at)",
    """
    CREATE TABLE api_token (
      id            INTEGER PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      token_hash    TEXT NOT NULL UNIQUE,
      scopes        TEXT NOT NULL,                 -- JSON: ["audio:read", "audio:write"]
      library_scope TEXT,                          -- JSON with ids; NULL = all the owner's libraries
      expires_at    TEXT,
      last_used_at  TEXT,
      created_at    TEXT NOT NULL
    )
    """,
)


TEARDOWN: tuple[str, ...] = (
    "DROP TABLE IF EXISTS api_token",
    "DROP TABLE IF EXISTS job",
    "DROP TABLE IF EXISTS audio_fts",
    "DROP TRIGGER IF EXISTS segment_fts_after_update",
    "DROP TRIGGER IF EXISTS segment_fts_after_delete",
    "DROP TRIGGER IF EXISTS segment_fts_after_insert",
    "DROP TABLE IF EXISTS segment_fts",
    "DROP TABLE IF EXISTS segment",
    "DROP TABLE IF EXISTS transcript",
    "DROP TABLE IF EXISTS audio_tag",
    "DROP TABLE IF EXISTS tag",
    "DROP TABLE IF EXISTS share",
    "DROP TABLE IF EXISTS audio",
    "DROP TABLE IF EXISTS category",
    "DROP TABLE IF EXISTS library",
    "DROP TABLE IF EXISTS session",
    "DROP TABLE IF EXISTS user",
)


def upgrade() -> None:
    for statement in SCHEMA:
        op.execute(statement.strip())


def downgrade() -> None:
    for statement in TEARDOWN:
        op.execute(statement)
