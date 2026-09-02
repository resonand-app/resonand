"""Configuration, through environment variables only (``OPS-3``).

Every setting is read from the environment with the ``SONARIUM_`` prefix. Nothing is read from a
configuration file inside the image, so an instance is fully described by its compose file.

Validation is split in two on purpose. Constructing :class:`Settings` only checks types, which
keeps tests free of ceremony; :meth:`Settings.validate_runtime` is what the entry points call, and
it reports *every* problem at once as text a person can act on rather than a traceback.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from sonarium.core.errors import ConfigurationError

MEGABYTE = 1024 * 1024
GIGABYTE = 1024 * MEGABYTE

MINIMUM_SECRET_LENGTH = 32
"""A shorter key is not a key. ``openssl rand -hex 32`` is what the message tells you to run."""


class Settings(BaseSettings):
    """Everything an instance can be told, and the defaults it runs on when told nothing."""

    model_config = SettingsConfigDict(
        env_prefix="SONARIUM_",
        extra="ignore",
        frozen=True,
    )

    # --- Where things live -------------------------------------------------

    data_dir: Path = Path("/data")
    """Everything mutable lives under here: the database, the storage tree, the temporary files."""

    database_path: Path | None = None
    """Overrides ``<data_dir>/sonarium.db``. Set to ``:memory:`` only in tests."""

    storage_dir: Path | None = None
    """Overrides ``<data_dir>/storage``, the tree of intact originals."""

    # --- Deployment --------------------------------------------------------

    secret_key: SecretStr | None = None
    """Signs short-lived stream tokens. Required at runtime; there is no default on purpose."""

    base_path: str = ""
    """Mount point behind a reverse proxy: empty for a subdomain, ``/sonarium`` for a subpath."""

    public_url: str | None = None
    """The absolute URL the instance is reached on, when it needs to build one."""

    log_level: Literal["debug", "info", "warning", "error"] = "info"
    log_format: Literal["console", "json"] = "json"

    # --- Sessions and retention -------------------------------------------

    session_ttl_days: int = Field(default=30, gt=0)
    trash_retention_days: int = Field(default=30, gt=0)
    """``DEC-3``: 30 days by default, per instance, never per library."""

    # --- Ingestion ---------------------------------------------------------

    max_upload_bytes: int = Field(default=8 * GIGABYTE, gt=0)
    """An hour of driving is not a large file; a multi-hour interview can be."""

    waveform_peaks_per_second: int = Field(default=10, gt=0)
    """``DEC-19``: fixed rate, so a stored waveform is comparable across recordings."""

    # --- Jobs and transcription -------------------------------------------

    job_concurrency: int = Field(default=2, gt=0)
    """How many jobs the in-process worker runs at once. Reads are free; writes serialise."""

    transcription_provider: str = "openai-compatible"
    transcription_base_url: str | None = None
    transcription_api_key: SecretStr | None = None
    transcription_model: str = "whisper-1"
    transcription_language: str | None = None
    """The instance default. ``None`` means auto-detect (``DEC-18``)."""

    transcription_request_max_bytes: int = Field(default=25 * MEGABYTE, gt=0)
    """``JOB-13``'s ceiling: the hosted path caps a request here, so chunking is required."""

    transcription_timeout_seconds: float = Field(default=900.0, gt=0)

    # --- Derived paths -----------------------------------------------------

    @property
    def resolved_database_path(self) -> Path:
        """The database file, whether it was given directly or derived from ``data_dir``."""
        if self.database_path is not None:
            return self.database_path
        return self.data_dir / "sonarium.db"

    @property
    def resolved_storage_dir(self) -> Path:
        """The root of the storage tree."""
        if self.storage_dir is not None:
            return self.storage_dir
        return self.data_dir / "storage"

    @property
    def is_memory_database(self) -> bool:
        """Whether this instance is running against an in-memory database, as tests do."""
        return str(self.resolved_database_path) == ":memory:"

    # --- Normalisation -----------------------------------------------------

    @field_validator("base_path")
    @classmethod
    def _normalise_base_path(cls, value: str) -> str:
        """A base path is either empty or a single leading slash with no trailing one.

        ``OPS-4`` exists because the subpath is the one that always ends up broken, and half of
        those breakages are a trailing slash somewhere.
        """
        trimmed = value.strip().strip("/")
        return f"/{trimmed}" if trimmed else ""

    @field_validator("public_url")
    @classmethod
    def _trim_public_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        trimmed = value.strip().rstrip("/")
        return trimmed or None

    # --- Runtime validation ------------------------------------------------

    def validate_runtime(self, *, require_secret: bool = True) -> None:
        """Check everything that can only be checked against the real machine.

        Raises a single :class:`ConfigurationError` listing every problem found, so an
        administrator fixes their compose file once instead of restarting five times.
        """
        problems: list[str] = []

        if require_secret and self.secret_key is None:
            problems.append(
                "SONARIUM_SECRET_KEY is not set. It signs the short-lived tokens that let the "
                "browser stream audio. Generate one with: openssl rand -hex 32"
            )
        elif (
            self.secret_key is not None
            and len(self.secret_key.get_secret_value()) < MINIMUM_SECRET_LENGTH
        ):
            problems.append(
                "SONARIUM_SECRET_KEY is shorter than 32 characters. Generate one with: "
                "openssl rand -hex 32"
            )

        if not self.is_memory_database:
            problems.extend(_directory_problems("SONARIUM_DATA_DIR", self.data_dir))
            database_parent = self.resolved_database_path.parent
            if database_parent != self.data_dir:
                problems.extend(_directory_problems("SONARIUM_DATABASE_PATH", database_parent))
            storage = self.resolved_storage_dir
            if storage.parent != self.data_dir:
                problems.extend(_directory_problems("SONARIUM_STORAGE_DIR", storage))

        if self.transcription_base_url is None:
            problems.append(
                "SONARIUM_TRANSCRIPTION_BASE_URL is not set, so no recording can be "
                "transcribed. Point it at a local faster-whisper server or an "
                "OpenAI-compatible endpoint."
            )

        if problems:
            listed = "\n".join(f"  - {problem}" for problem in problems)
            raise ConfigurationError(f"This instance is not configured to run:\n{listed}")

    def prepare_directories(self) -> None:
        """Create the directories the instance writes to, before anything tries to."""
        if self.is_memory_database:
            return
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.resolved_database_path.parent.mkdir(parents=True, exist_ok=True)
        self.resolved_storage_dir.mkdir(parents=True, exist_ok=True)


def _directory_problems(name: str, directory: Path) -> list[str]:
    """Whether a configured directory is usable, phrased as something to fix."""
    if directory.exists() and not directory.is_dir():
        return [f"{name} points at {directory}, which exists but is not a directory."]
    probe = directory
    while not probe.exists() and probe != probe.parent:
        probe = probe.parent
    if not probe.exists():
        return [f"{name} points at {directory}, which cannot be created."]
    return []


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """The instance's settings, read once."""
    return Settings()


def reset_settings_cache() -> None:
    """Forget the cached settings. For tests that change the environment."""
    get_settings.cache_clear()
