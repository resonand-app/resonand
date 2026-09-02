"""Alembic's entry point, wired to the instance's own configuration.

The database URL never appears in ``alembic.ini``: it comes from
:class:`sonarium.core.config.Settings`, so ``alembic upgrade head`` typed by hand and the
automatic upgrade at startup (``OPS-7``) can never disagree about which file they are migrating.

A caller may hand in a live connection through ``config.attributes["connection"]``, which is what
:func:`sonarium.db.migrate.upgrade_to_head` does. That is the only way to migrate an in-memory
database, and it keeps the migration on a connection that already carries the pragmas.
"""

from __future__ import annotations

from alembic import context
from sonarium.core.config import get_settings
from sonarium.db.engine import build_engine, database_url
from sonarium.db.models import METADATA
from sqlalchemy import Connection


def _configure(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=METADATA,
        # SQLite can barely ALTER a table, so any future revision that changes one has to be
        # rendered as copy-and-rename.
        render_as_batch=True,
        compare_type=True,
    )


def run_migrations_offline() -> None:
    """Emit the DDL as text, for an administrator who wants to read it before it runs."""
    context.configure(
        url=database_url(get_settings()),
        target_metadata=METADATA,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run the migrations against a real database."""
    handed_in = context.config.attributes.get("connection")
    if isinstance(handed_in, Connection):
        _configure(handed_in)
        with context.begin_transaction():
            context.run_migrations()
        return

    engine = build_engine(get_settings())
    try:
        with engine.connect() as connection:
            _configure(connection)
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
