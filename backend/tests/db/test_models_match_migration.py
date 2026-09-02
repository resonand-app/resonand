"""The migration and the models are two hand-written descriptions of one schema.

Nothing but this test stops them drifting apart, and drift here is the expensive kind: the models
are what every query is written against, and the migration is what the archive actually is.
"""

from __future__ import annotations

from sonarium.db.models import METADATA
from sqlalchemy import Engine, inspect

FTS_TABLES = frozenset({"audio_fts", "segment_fts"})
"""Virtual tables have no stable column shape a mapper could describe, so they have no model.
Their shadow tables (``*_data``, ``*_idx``, ``*_docsize``, ``*_config``, ``*_content``) are
SQLite's own storage and are not part of the schema anybody writes against."""

NOT_MODELLED = frozenset({"alembic_version"})


def _real_tables(engine: Engine) -> set[str]:
    """The tables the application describes, without FTS5's machinery."""
    names = set(inspect(engine).get_table_names())
    shadows = {name for name in names if any(name.startswith(f"{fts}_") for fts in FTS_TABLES)}
    return names - shadows - FTS_TABLES - NOT_MODELLED


def test_every_migrated_table_has_a_model(db_engine: Engine) -> None:
    assert _real_tables(db_engine) == set(METADATA.tables)


def test_every_model_column_exists_in_the_migrated_table(db_engine: Engine) -> None:
    inspector = inspect(db_engine)
    mismatched: dict[str, tuple[set[str], set[str]]] = {}
    for name, table in METADATA.tables.items():
        migrated = {column["name"] for column in inspector.get_columns(name)}
        declared = {column.name for column in table.columns}
        if migrated != declared:
            mismatched[name] = (declared - migrated, migrated - declared)
    assert not mismatched, f"models and migration disagree: {mismatched}"


def test_the_search_indexes_exist_even_though_they_have_no_model(db_engine: Engine) -> None:
    assert set(inspect(db_engine).get_table_names()) >= FTS_TABLES
