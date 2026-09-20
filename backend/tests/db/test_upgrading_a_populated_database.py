"""Every released revision, upgraded with an archive already in it (``OPS-6``).

The uncounted metric for the whole project is whether an instance that already holds somebody's
recordings survives being updated. A test that migrates an empty database proves the DDL parses;
this one puts an archive in at each revision and asks, after the upgrade, whether it is still
there.

**It is a walk over the revision tree rather than a pair.** Writing it as "the previous revision
to head" means rewriting it every time a revision lands, and the rewrite happens in the same
session as the migration it is meant to be checking. The walk is the version that already covers
``0004`` on the day somebody writes it, and it is the single-hop half of ``OPS-9``, which owes the
rest: this runs against the revisions in *this* checkout, not against every version ever released.

The seed is raw SQL on purpose. ``sonarium.db.models`` describes the schema at head, so using the
ORM to populate a database at ``0001`` would fail on a column that revision has never heard of --
and using it to read the rows back afterwards would only ever prove that head can read head.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from alembic.script import ScriptDirectory
from sonarium.core.config import Settings
from sonarium.db.engine import build_engine
from sonarium.db.migrate import alembic_config, migrate_at_startup, run_upgrade
from sqlalchemy import Connection, text

INSTANT = "2026-01-01T09:00:00.000Z"

SEED: dict[str, tuple[dict[str, Any], ...]] = {
    "user": (
        {
            "id": 1,
            "email": "Owner@example.test",
            "email_normalised": "owner@example.test",
            "display_name": "Owner",
            "is_admin": 1,
            "created_at": INSTANT,
        },
    ),
    "library": (
        {
            "id": 1,
            "uuid": "0193f0aa-0000-7000-8000-000000000001",
            "owner_id": 1,
            "name": "Recordings",
            "colour": "moss",
            "created_at": INSTANT,
        },
    ),
    "audio": (
        {
            "id": 1,
            "uuid": "0193f0aa-1111-7000-8000-000000000001",
            "library_id": 1,
            "uploaded_by": 1,
            "title": "The first recording",
            "storage_path": "aa/bb/first/original.m4a",
            "original_filename": "first.m4a",
            "duration_ms": 61_000,
            "deleted_at": None,
            # A wall clock with its offset apart from it (DEC-11), which is the pair a migration
            # that touched either half would be caught mixing up.
            "recorded_at": "2025-06-01T18:30:00",
            "recorded_at_offset": 120,
            "recorded_at_source": "container",
            "created_at": INSTANT,
        },
        {
            "id": 2,
            "uuid": "0193f0aa-1111-7000-8000-000000000002",
            "library_id": 1,
            "uploaded_by": 1,
            "title": "The second recording",
            "storage_path": "aa/bb/second/original.m4a",
            "original_filename": None,
            "duration_ms": 122_000,
            "deleted_at": None,
            # No wall clock at all, which is the ordinary case and the one a migration touching
            # the recorded-at columns is most likely to fill in with something.
            "recorded_at": None,
            "recorded_at_offset": None,
            "recorded_at_source": None,
            "created_at": INSTANT,
        },
        {
            "id": 3,
            "uuid": "0193f0aa-1111-7000-8000-000000000003",
            "library_id": 1,
            "uploaded_by": 1,
            "title": "The recording in the trash",
            "storage_path": "aa/bb/third/original.m4a",
            "original_filename": None,
            "duration_ms": 8_000,
            "recorded_at": None,
            "recorded_at_offset": None,
            "recorded_at_source": None,
            "created_at": INSTANT,
            "deleted_at": INSTANT,
        },
    ),
    "transcript": (
        {
            "id": 1,
            "audio_id": 1,
            "is_active": 1,
            "source": "service",
            "provider": "openai-compatible",
            "model": "whisper-1",
            "language": "en",
            "task": "transcribe",
            "stitched_from": 2,
            "created_at": INSTANT,
        },
    ),
    "segment": (
        {
            "id": 1,
            "transcript_id": 1,
            "idx": 0,
            "start_ms": 0,
            "end_ms": 900,
            "text": "A first segment",
        },
        {
            "id": 2,
            "transcript_id": 1,
            "idx": 1,
            "start_ms": 900,
            "end_ms": 1800,
            "text": "A second segment",
        },
        {
            "id": 3,
            "transcript_id": 1,
            "idx": 2,
            "start_ms": 1800,
            "end_ms": 2700,
            "text": "A third segment",
        },
    ),
}
"""One archive, written as the columns head knows about.

Inserted at an older revision, every column that revision has not got yet is dropped from the
statement -- so the seed says what the archive is once, and each revision gets the part of it that
existed at the time.
"""


def revisions_below_head() -> list[str]:
    """Every released revision a real instance could be sitting at, oldest first.

    Head is not one of them: upgrading head to head is the no-op that
    ``test_starting_again_changes_nothing`` already covers, and it is what this test used to be.
    """
    script = ScriptDirectory.from_config(alembic_config())
    head = script.get_current_head()
    walk = [revision.revision for revision in script.walk_revisions()]
    return [revision for revision in reversed(walk) if revision != head]


def columns_at(connection: Connection, table: str) -> dict[str, Any]:
    """What ``table`` looks like right now, by column name."""
    rows = connection.execute(text(f"PRAGMA table_info({table})")).mappings().all()
    return {row["name"]: row for row in rows}


def seed(connection: Connection, revision: str) -> dict[str, tuple[str, ...]]:
    """Write the archive at whatever schema this revision has, and say what was written.

    Returns the columns actually inserted per table, because those are the only ones the check
    afterwards can hold the upgrade to: a column a later revision adds is the migration's to fill,
    not the seed's.
    """
    written: dict[str, tuple[str, ...]] = {}
    for table, rows in SEED.items():
        present = columns_at(connection, table)
        assert present, f"{table} does not exist at {revision}"
        required = {
            name
            for name, column in present.items()
            if column["notnull"] and column["dflt_value"] is None and not column["pk"]
        }
        assert all(row.keys() == rows[0].keys() for row in rows), (
            f"every seeded {table} row has to carry the same columns, so what was written is one "
            f"statement and one list of names rather than one of each per row"
        )
        missing = required - set(rows[0])
        assert not missing, (
            f"{revision} requires {sorted(missing)} on {table} and the seed has no value for it. "
            f"Add one to SEED -- this test cannot populate a schema it has no rows for."
        )
        names = tuple(name for name in rows[0] if name in present)
        placeholders = ", ".join(f":{name}" for name in names)
        statement = text(
            f"INSERT INTO {table} ({', '.join(names)}) VALUES ({placeholders})"  # noqa: S608
        )
        for row in rows:
            connection.execute(statement, {name: row[name] for name in names})
        written[table] = names
    return written


@pytest.mark.parametrize("revision", revisions_below_head())
def test_an_archive_written_at_this_revision_survives_the_upgrade_to_head(
    revision: str, tmp_path: Path
) -> None:
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "sonarium.db")
    settings.prepare_directories()

    engine = build_engine(settings)
    try:
        with engine.begin() as connection:
            run_upgrade(connection, revision)
        with engine.begin() as connection:
            written = seed(connection, revision)
    finally:
        engine.dispose()

    before, after = migrate_at_startup(settings)
    assert before == revision
    assert after != before, "this test is worthless unless the upgrade had something to do"

    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            for table, names in written.items():
                found = {
                    row["id"]: row
                    for row in connection.execute(text(f"SELECT * FROM {table}"))  # noqa: S608
                    .mappings()
                    .all()
                }
                assert len(found) == len(SEED[table]), f"{table} lost rows"
                for row in SEED[table]:
                    for name in names:
                        assert found[row["id"]][name] == row[name], (
                            f"{table}.{name} on row {row['id']} came out of the upgrade changed"
                        )
            indexed = connection.execute(
                text("SELECT count(*) FROM segment_fts WHERE segment_fts MATCH 'segment'")
            ).scalar_one()
    finally:
        engine.dispose()

    assert indexed == len(SEED["segment"]), (
        "the transcripts are there but the search index is not, which looks like a working "
        "archive until somebody searches it"
    )
