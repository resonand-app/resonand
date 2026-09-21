"""A small archive with every permission shape in it, built once per test.

The names are deliberately concrete. A matrix of ``user_a``/``user_b`` reads as bookkeeping; an
owner, a reader and a stranger read as the situations the ACL actually has to get right.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import pytest
from resonand.core.levels import Level
from resonand.db.engine import Database
from sqlalchemy import text

from tests.db.rows import insert_audio, insert_library, insert_user


@dataclass(frozen=True, slots=True)
class Archive:
    """Ids for the fixture below, so a test reads as a sentence about people."""

    owner: int
    reader: int
    editor: int
    manager: int
    stranger: int
    disabled: int
    library: int
    audio: int
    private_library: int
    private_audio: int


def _share(
    database: Database,
    *,
    granter: int,
    grantee: int,
    level: Level,
    library_id: int | None = None,
    audio_id: int | None = None,
) -> None:
    with database.write_session() as session:
        session.execute(
            text(
                "INSERT INTO share (library_id, audio_id, grantee_id, level, granted_by, "
                "created_at) VALUES (:library, :audio, :grantee, :level, :granter, '')"
            ),
            {
                "library": library_id,
                "audio": audio_id,
                "grantee": grantee,
                "level": int(level),
                "granter": granter,
                "created_at": "",
            },
        )


@pytest.fixture
def archive(database: Database) -> Archive:
    with database.write_session() as session:
        connection = session.connection()
        owner = insert_user(connection, email="owner@example.test")
        reader = insert_user(connection, email="reader@example.test")
        editor = insert_user(connection, email="editor@example.test")
        manager = insert_user(connection, email="manager@example.test")
        stranger = insert_user(connection, email="stranger@example.test")
        disabled = insert_user(connection, email="disabled@example.test")
        connection.execute(
            text("UPDATE user SET disabled_at = '2026-01-01T00:00:00.000Z' WHERE id = :id"),
            {"id": disabled},
        )
        library = insert_library(connection, owner, name="Shared")
        audio = insert_audio(connection, library, owner, title="The afternoon about the factory")
        private_library = insert_library(connection, owner, name="Private")
        private_audio = insert_audio(connection, private_library, owner, title="Nobody else's")

    for grantee, level in ((reader, Level.READ), (editor, Level.EDIT), (manager, Level.MANAGE)):
        _share(database, granter=owner, grantee=grantee, level=level, library_id=library)
    _share(database, granter=owner, grantee=disabled, level=Level.MANAGE, library_id=library)

    return Archive(
        owner=owner,
        reader=reader,
        editor=editor,
        manager=manager,
        stranger=stranger,
        disabled=disabled,
        library=library,
        audio=audio,
        private_library=private_library,
        private_audio=private_audio,
    )


class Grant(Protocol):
    """Grants something during a test, so a test can build the shape it is about."""

    def __call__(
        self,
        *,
        granter: int,
        grantee: int,
        level: Level,
        library_id: int | None = None,
        audio_id: int | None = None,
    ) -> None: ...


@pytest.fixture
def share(database: Database) -> Grant:
    """Grant something during a test."""

    def grant(
        *,
        granter: int,
        grantee: int,
        level: Level,
        library_id: int | None = None,
        audio_id: int | None = None,
    ) -> None:
        _share(
            database,
            granter=granter,
            grantee=grantee,
            level=level,
            library_id=library_id,
            audio_id=audio_id,
        )

    return grant
