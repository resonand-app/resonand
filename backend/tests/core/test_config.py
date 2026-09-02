"""Configuration is environment-only, and says what is wrong in words (``OPS-3``)."""

from __future__ import annotations

from pathlib import Path

import pytest
from sonarium.core.config import Settings
from sonarium.core.errors import ConfigurationError


def _runnable(tmp_path: Path, **overrides: object) -> Settings:
    defaults: dict[str, object] = {
        "data_dir": tmp_path,
        "secret_key": "0" * 64,
        "transcription_base_url": "http://whisper:8000/v1",
    }
    return Settings(**(defaults | overrides))  # type: ignore[arg-type]


def test_paths_derive_from_the_data_directory(tmp_path: Path) -> None:
    settings = _runnable(tmp_path)
    assert settings.resolved_database_path == tmp_path / "sonarium.db"
    assert settings.resolved_storage_dir == tmp_path / "storage"


@pytest.mark.parametrize(
    ("given", "normalised"),
    [("", ""), ("/", ""), ("sonarium", "/sonarium"), ("/sonarium/", "/sonarium")],
)
def test_a_base_path_is_normalised_once_rather_than_at_every_use(
    tmp_path: Path, given: str, normalised: str
) -> None:
    """OPS-4 exists because the subpath is the one that always ends up broken."""
    assert _runnable(tmp_path, base_path=given).base_path == normalised


def test_a_runnable_instance_validates(tmp_path: Path) -> None:
    _runnable(tmp_path).validate_runtime()


def test_every_problem_is_reported_at_once(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)
    with pytest.raises(ConfigurationError) as raised:
        settings.validate_runtime()
    message = str(raised.value)
    assert "SONARIUM_SECRET_KEY" in message
    assert "SONARIUM_TRANSCRIPTION_BASE_URL" in message


def test_a_short_secret_is_refused_with_the_command_that_makes_a_good_one(
    tmp_path: Path,
) -> None:
    with pytest.raises(ConfigurationError, match="openssl rand -hex 32"):
        _runnable(tmp_path, secret_key="tooshort").validate_runtime()


def test_a_data_directory_that_is_a_file_is_refused(tmp_path: Path) -> None:
    occupied = tmp_path / "occupied"
    occupied.write_text("not a directory")
    with pytest.raises(ConfigurationError, match="not a directory"):
        _runnable(tmp_path, data_dir=occupied).validate_runtime()


def test_directories_are_created_before_anything_writes_to_them(tmp_path: Path) -> None:
    settings = _runnable(tmp_path, data_dir=tmp_path / "fresh")
    settings.prepare_directories()
    assert settings.resolved_storage_dir.is_dir()


def test_settings_are_read_from_the_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("SONARIUM_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("SONARIUM_TRASH_RETENTION_DAYS", "7")
    settings = Settings()
    assert settings.data_dir == tmp_path
    assert settings.trash_retention_days == 7
