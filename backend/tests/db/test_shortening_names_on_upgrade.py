"""An archive upgraded from ``0.1.0`` holds no name over its limit (``DAT-12``).

Seeded in raw SQL at ``0005``, for the reason ``test_upgrading_a_populated_database.py`` gives:
the ORM describes head, and a database at an older revision is not head.
"""

from __future__ import annotations

from pathlib import Path

from resonand.core.config import Settings
from resonand.core.text import LIBRARY_NAME_MAX_LENGTH, TITLE_MAX_LENGTH
from resonand.db.engine import build_engine
from resonand.db.migrate import migrate_at_startup, run_upgrade
from sqlalchemy import text

INSTANT = "2026-01-01T09:00:00.000Z"
LONG_TITLE = " ".join(f"word{index:03d}" for index in range(37)) + " harbourside"
LONG_NAME = " ".join(f"shelf{index:02d}" for index in range(20))


def test_over_long_titles_and_names_are_shortened_and_still_found(tmp_path: Path) -> None:
    assert len(LONG_TITLE) > TITLE_MAX_LENGTH
    assert len(LONG_NAME) > LIBRARY_NAME_MAX_LENGTH
    settings = Settings(data_dir=tmp_path, database_path=tmp_path / "resonand.db")
    settings.prepare_directories()

    engine = build_engine(settings)
    try:
        with engine.begin() as connection:
            run_upgrade(connection, "0005_favourites")
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO user (id, email, email_normalised, display_name, is_admin, "
                    "created_at) VALUES (1, 'o@x.test', 'o@x.test', 'O', 1, :at)"
                ),
                {"at": INSTANT},
            )
            connection.execute(
                text(
                    "INSERT INTO library (id, uuid, owner_id, name, colour, created_at) "
                    "VALUES (1, 'lib-1', 1, :name, 'moss', :at)"
                ),
                {"name": LONG_NAME, "at": INSTANT},
            )
            for audio_id, deleted_at in ((1, None), (2, INSTANT)):
                connection.execute(
                    text(
                        "INSERT INTO audio (id, uuid, library_id, uploaded_by, title, "
                        "storage_path, original_filename, created_at, deleted_at) "
                        "VALUES (:id, :uuid, 1, 1, :title, 'x', :filename, :at, :deleted_at)"
                    ),
                    {
                        "id": audio_id,
                        "uuid": f"audio-{audio_id}",
                        "title": LONG_TITLE,
                        "filename": f"{LONG_TITLE}.m4a",
                        "at": INSTANT,
                        "deleted_at": deleted_at,
                    },
                )
            connection.execute(
                text("INSERT INTO audio_fts(rowid, title, notes, tags) VALUES (1, :title, '', '')"),
                {"title": LONG_TITLE},
            )
    finally:
        engine.dispose()

    migrate_at_startup(settings)

    engine = build_engine(settings)
    try:
        with engine.connect() as connection:
            titles = connection.execute(text("SELECT id, title FROM audio ORDER BY id")).all()
            filenames = connection.execute(text("SELECT original_filename FROM audio")).scalars()
            name = connection.execute(text("SELECT name FROM library")).scalar_one()
            early = connection.execute(
                text("SELECT rowid FROM audio_fts WHERE audio_fts MATCH 'word000'")
            ).scalars()
            late = connection.execute(
                text("SELECT rowid FROM audio_fts WHERE audio_fts MATCH 'harbourside'")
            ).scalars()
            early_hits, late_hits = list(early), list(late)
            kept = list(filenames)
    finally:
        engine.dispose()

    assert len(titles) == 2, "the one in the trash as well, since it can be restored"
    for _, title in titles:
        assert len(title) <= TITLE_MAX_LENGTH
        assert LONG_TITLE.startswith(title)
        assert LONG_TITLE[len(title)] == " ", "cut at a space, not inside a word"
    assert len(name) <= LIBRARY_NAME_MAX_LENGTH
    assert LONG_NAME.startswith(name)
    assert kept == [f"{LONG_TITLE}.m4a"] * 2, "the whole name stays on the recording"
    assert early_hits == [1], "a word still in the title is still found"
    assert late_hits == [], "a word cut from the title is no longer found by it"
