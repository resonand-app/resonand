"""The connection layer (``DAT-2``).

Sonarium runs as **one container with one process and an in-process job worker**, against SQLite
in WAL mode. That topology is what makes the rest of this module simple, and it is also what
makes it necessary:

* **Reads are free.** In WAL a reader never blocks a writer and a writer never blocks a reader, so
  :func:`read_session` opens as many concurrent connections as the pool allows.
* **Writes serialise through one lock.** SQLite allows a single writer at a time; the honest way
  to honour that is a process-wide :class:`threading.Lock` held for the whole write transaction,
  not a generous ``busy_timeout`` and the hope that nothing overlaps. ``busy_timeout`` stays set
  as the second line of defence, for the writer this process does not know about -- a backup, a
  ``sqlite3`` shell, a checkpoint.

The pragmas are applied through a pool event rather than once after connecting, because
``foreign_keys`` is **per connection** in SQLite: a pooled connection that escapes the listener
would silently accept a category from another library, which is precisely what the composite
foreign key in the first migration is there to prevent.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator
from contextlib import contextmanager
from functools import lru_cache

from sqlalchemy import CursorResult, Engine, create_engine
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.engine.interfaces import DBAPIConnection
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry, StaticPool

from sonarium.core.config import Settings, get_settings

BUSY_TIMEOUT_MS = 5000
"""How long to wait for a writer outside this process before giving up.

Nothing inside the process ever needs it -- the lock below has already serialised us -- so this
number only has to cover a checkpoint or an administrator's ``sqlite3`` session.
"""

CONNECTION_PRAGMAS: tuple[str, ...] = (
    "PRAGMA journal_mode=WAL",
    "PRAGMA foreign_keys=ON",
    f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}",
    "PRAGMA synchronous=NORMAL",
)
"""``synchronous=NORMAL`` is safe under WAL: a power cut can lose the last commits, never the
database file. ``FULL`` would cost an fsync per transaction and buy durability this application
does not promise."""

_WRITE_LOCK = threading.Lock()
"""The single writer. Module-level on purpose: one process, one database, one lock."""


def changed_rows(result: object) -> int:
    """How many rows a DML statement touched.

    ``Session.execute`` is typed as returning a generic ``Result``, which has no row count;
    every ``UPDATE`` and ``DELETE`` actually returns a ``CursorResult``, which does. One
    helper rather than an ``isinstance`` at each call site.
    """
    return int(result.rowcount) if isinstance(result, CursorResult) else 0


def database_url(settings: Settings) -> str:
    """The SQLAlchemy URL for this instance's database."""
    if settings.is_memory_database:
        return "sqlite+pysqlite:///:memory:"
    return f"sqlite+pysqlite:///{settings.resolved_database_path}"


def build_engine(settings: Settings) -> Engine:
    """An engine with the pragmas attached, against a file or against memory.

    An in-memory database lives only inside the connection that created it, so that case pins the
    pool to a single shared connection. It is a test convenience: the concurrency guarantees this
    module makes are only meaningful against a file, and are tested there.
    """
    if settings.is_memory_database:
        engine = create_engine(
            database_url(settings),
            poolclass=StaticPool,
            connect_args={"check_same_thread": False},
        )
    else:
        engine = create_engine(database_url(settings))
    _attach_pragmas(engine)
    return engine


def _attach_pragmas(engine: Engine) -> None:
    """Make every connection this engine hands out arrive already configured."""

    @sqlalchemy_event.listens_for(engine, "connect")
    def _apply(connection: DBAPIConnection, _record: ConnectionPoolEntry) -> None:
        cursor = connection.cursor()
        try:
            for pragma in CONNECTION_PRAGMAS:
                cursor.execute(pragma)
        finally:
            cursor.close()


class Database:
    """One database, with the two ways of touching it kept apart.

    The split is the interface: a caller that opens a :meth:`read_session` cannot accidentally
    hold the write lock, and a caller that opens a :meth:`write_session` cannot forget to commit.
    """

    def __init__(self, engine: Engine) -> None:
        self.engine = engine
        self._sessions = sessionmaker(
            bind=engine,
            expire_on_commit=False,
            # Objects stay usable after the session closes, which is what a caller of
            # write_session() invariably expects of the rows it just wrote.
        )

    @contextmanager
    def read_session(self) -> Iterator[Session]:
        """A concurrent, uncommitted view of the database. Never takes the write lock."""
        session = self._sessions()
        try:
            yield session
        finally:
            session.close()

    @contextmanager
    def write_session(self) -> Iterator[Session]:
        """The only way to change anything. Serialised, committed on exit, rolled back on error."""
        with _WRITE_LOCK:
            session = self._sessions()
            try:
                yield session
                session.commit()
            except BaseException:
                session.rollback()
                raise
            finally:
                session.close()

    def dispose(self) -> None:
        """Close every pooled connection. Tests call this; the process does so at shutdown."""
        self.engine.dispose()


@lru_cache(maxsize=1)
def get_database() -> Database:
    """The process's database, built once from the environment."""
    return Database(build_engine(get_settings()))


def reset_database() -> None:
    """Forget the process's database, closing its connections. For tests and for shutdown."""
    if get_database.cache_info().currsize:
        get_database().dispose()
    get_database.cache_clear()


@contextmanager
def read_session() -> Iterator[Session]:
    """A read session against the process's database."""
    with get_database().read_session() as session:
        yield session


@contextmanager
def write_session() -> Iterator[Session]:
    """A write session against the process's database."""
    with get_database().write_session() as session:
        yield session
