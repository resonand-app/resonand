"""Configuration is environment-only, and says what is wrong in words (``OPS-3``)."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError
from sonarium.core.config import ConfigurationReport, Settings


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


def test_a_runnable_instance_has_nothing_to_report(tmp_path: Path) -> None:
    assert _runnable(tmp_path).configuration_problems() == ConfigurationReport((), ())


def test_every_fatal_problem_is_reported_at_once(tmp_path: Path) -> None:
    """One restart, not two: an administrator fixes the compose file once."""
    occupied = tmp_path / "occupied"
    occupied.write_text("not a directory")
    fatal = Settings(data_dir=occupied).configuration_problems().fatal
    assert any("SONARIUM_SECRET_KEY" in problem for problem in fatal)
    assert any("SONARIUM_DATA_DIR" in problem for problem in fatal)


def test_an_archive_with_no_transcriber_still_runs(tmp_path: Path) -> None:
    """An instance that cannot transcribe can still hold, play and search what is already in it.

    Refusing to start over it would turn one missing feature into a missing archive.
    """
    report = _runnable(tmp_path, transcription_base_url=None).configuration_problems()
    assert report.fatal == ()
    assert any("SONARIUM_TRANSCRIPTION_BASE_URL" in advisory for advisory in report.advisory)


def test_a_secret_set_to_nothing_is_a_secret_that_is_not_set(tmp_path: Path) -> None:
    """`deploy/.env.example` ships `SONARIUM_SECRET_KEY=`, which pydantic reads as a zero-length
    SecretStr -- not None, and so past every `is None` guard in front of the signer."""
    settings = _runnable(tmp_path, secret_key="")
    assert settings.secret_key is None
    assert any("is not set" in problem for problem in settings.configuration_problems().fatal)


def test_a_short_secret_is_refused_with_the_command_that_makes_a_good_one(
    tmp_path: Path,
) -> None:
    fatal = _runnable(tmp_path, secret_key="tooshort").configuration_problems().fatal
    assert any("openssl rand -hex 32" in problem for problem in fatal)


def test_a_data_directory_that_is_a_file_is_refused(tmp_path: Path) -> None:
    occupied = tmp_path / "occupied"
    occupied.write_text("not a directory")
    fatal = _runnable(tmp_path, data_dir=occupied).configuration_problems().fatal
    assert any("not a directory" in problem for problem in fatal)


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


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        (True, "true"),
        (False, "false"),
        ("true", "true"),
        ("TRUE", "true"),
        ("1", "true"),
        ("yes", "true"),
        ("on", "true"),
        ("false", "false"),
        ("0", "false"),
        ("off", "false"),
        ("auto", "auto"),
    ],
)
def test_the_cookie_setting_keeps_every_spelling_it_ever_took(
    tmp_path: Path, given: object, expected: str
) -> None:
    """It was a boolean, and an existing compose file must not stop the instance booting."""
    assert _runnable(tmp_path, session_cookie_secure=given).session_cookie_secure == expected


def test_the_cookie_setting_refuses_a_spelling_it_cannot_read(tmp_path: Path) -> None:
    """Silently reading an unknown word as `false` would turn a typo into an unmarked cookie."""
    with pytest.raises(ValidationError):
        _runnable(tmp_path, session_cookie_secure="maybe")


@pytest.mark.parametrize(
    ("setting", "scheme", "marked"),
    [
        ("auto", "https", True),
        ("auto", "http", False),
        ("true", "http", True),
        ("true", "https", True),
        ("false", "https", False),
    ],
)
def test_who_decides_whether_the_cookie_is_marked(
    tmp_path: Path, setting: str, scheme: str, marked: bool
) -> None:
    settings = _runnable(tmp_path, session_cookie_secure=setting)
    assert settings.cookie_secure_for(scheme) is marked


def test_only_an_instance_that_says_it_is_https_refuses_plain_http(tmp_path: Path) -> None:
    assert _runnable(tmp_path, session_cookie_secure="true").refuses_plain_http()
    assert not _runnable(tmp_path, session_cookie_secure="auto").refuses_plain_http()
    assert not _runnable(tmp_path, session_cookie_secure="false").refuses_plain_http()
