"""Configuration, through environment variables only (``OPS-3``).

Every setting is read from the environment with the ``SONARIUM_`` prefix. Nothing is read from a
configuration file inside the image, so an instance is fully described by its compose file.

Validation is split in two on purpose. Constructing :class:`Settings` only checks types, which
keeps tests free of ceremony; :meth:`Settings.configuration_problems` is what the entry point
reads, and it reports *every* problem at once as text a person can act on rather than a
traceback. Only the branch that reads the environment asks, so a test that hands settings in is
never asked for a signing key it has no use for.
"""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MEGABYTE = 1024 * 1024
GIGABYTE = 1024 * MEGABYTE

MINIMUM_SECRET_LENGTH = 32
"""A shorter key is not a key. ``openssl rand -hex 32`` is what the message tells you to run."""

CookieSecurity = Literal["auto", "true", "false"]
"""How :attr:`Settings.session_cookie_secure` is answered. Spelled as the strings an environment
variable carries, because that is where every value of it comes from."""


@dataclass(frozen=True, slots=True)
class ConfigurationReport:
    """What is wrong with an instance's configuration, sorted by whether it may still start."""

    fatal: tuple[str, ...]
    """Problems that stop the instance. Each is phrased as the thing to go and fix."""

    advisory: tuple[str, ...]
    """Problems it can run with. A feature will be missing and nobody should be surprised."""


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

    static_dir: Path = Path("/app/static")
    """Where the built web interface is, when there is one (``INF-3e``).

    The image copies Vite's bundle here. Nothing else does, so on a developer's machine this
    path does not exist, no shell is installed and ``/`` goes on saying what the instance is --
    which is the arrangement ``npm run dev`` beside ``uvicorn`` needs. It is read-only and is
    deliberately not under ``data_dir``: it is part of the build, not part of the archive."""

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

    session_cookie_name: str = "sonarium_session"

    session_cookie_secure: CookieSecurity = "auto"
    """Whether the session cookie is marked ``Secure``, which decides whether it survives at all.

    A browser silently discards a ``Secure`` cookie that arrives over plain HTTP unless the origin
    is loopback. That is a property of the connection rather than of the instance, and one instance
    is legitimately reached both ways -- through a TLS proxy from outside, and directly on a LAN --
    so a single answer for every request is wrong for one of them. The three values say which
    question is being answered:

    * ``auto`` -- the connection decides. Marked ``Secure`` when the request arrived over HTTPS,
      which is what :meth:`cookie_secure_for` reads. Every deployment works, and each connection
      gets a cookie as safe as the channel it crossed.
    * ``true`` -- this instance is HTTPS, and plain HTTP is a mistake rather than a fallback. The
      cookie is always marked, and signing in over plain HTTP is refused outright instead of
      accepted and then dropped, so the password never crosses in clear either.
    * ``false`` -- never marked. For an instance that is plain HTTP on purpose and would rather
      pin that than have it inferred.

    ``true`` and ``false`` are the spellings this setting has always taken, so an existing
    environment keeps its meaning.
    """

    login_attempts_per_minute: int = Field(default=10, gt=0)
    """Per address *and* client together. Enough that nobody notices; too few to grind through a
    password list (``INT-5``).

    Both halves of that key matter (``SEC-3``): counting the address alone let anybody who knew
    an address lock its owner out from anywhere, which is a denial of service dressed as a
    protection."""

    login_attempts_per_client_per_minute: int = Field(default=60, gt=0)
    """The second ceiling, on one client whatever addresses it names (``SEC-3``).

    Higher than the per-account one because a household behind one address is an ordinary thing
    and a few people getting their passwords wrong at once must not lock the door. Low enough
    that walking an address list from one place is not worth starting."""
    trash_retention_days: int = Field(default=30, gt=0)
    """``DEC-3``: 30 days by default, per instance, never per library."""

    # --- Ingestion ---------------------------------------------------------

    max_upload_bytes: int = Field(default=8 * GIGABYTE, gt=0)
    """An hour of driving is not a large file; a multi-hour interview can be."""

    max_request_bytes: int = Field(default=MEGABYTE, gt=0)
    """The ceiling on every request that is *not* an upload (``SEC-1``).

    A sign-in, a metadata edit and a share are all a few hundred bytes, so this is generous by
    three orders of magnitude and still small enough that no unauthenticated caller can spend the
    instance's disk or memory by describing a body it will never accept."""

    waveform_peaks_per_second: int = Field(default=10, gt=0)
    """``DEC-19``: fixed rate, so a stored waveform is comparable across recordings."""

    # --- Jobs and transcription -------------------------------------------

    job_concurrency: int = Field(default=2, gt=0)
    """How many jobs the in-process worker runs at once. Reads are free; writes serialise."""

    transcription_concurrency: int = Field(default=1, gt=0)
    """How many transcriptions may be in flight at once, whatever :attr:`job_concurrency` is.

    One, because the reference deployment is a local server with one device: a second request
    does not halve the wall clock, it competes for the same memory, and the way that shows up is
    a job failing mid-recording rather than a queue running slow. A hosted endpoint would take
    several happily, which is why this is a number and not a lock."""

    run_worker: bool = True
    """Whether this process runs the job worker.

    One process runs both, and ``DAT-2`` rests on there being only one (``REV-11``). Turning this
    off stops jobs running here; it does not make a second process safe to point at the same
    database, because the write lock is in this one's memory and the other would not see it."""

    transcription_provider: str = "openai-compatible"
    transcription_base_url: str | None = None
    transcription_api_key: SecretStr | None = None
    transcription_model: str = "whisper-1"
    transcription_language: str | None = None
    """The instance default. ``None`` means auto-detect (``DEC-18``)."""

    transcription_request_max_bytes: int = Field(default=25 * MEGABYTE, gt=0)
    """``JOB-13``'s ceiling: the hosted path caps a request here, so chunking is required."""

    transcription_timeout_seconds: float = Field(default=900.0, gt=0)

    transcription_max_part_seconds: int = Field(default=600, gt=0)
    """How long a part may be before ``JOB-13`` splits. Ten minutes keeps a local server
    inside its memory and timeout ceilings; the byte limit above caps it independently."""

    transcription_overlap_seconds: float = Field(default=3.0, ge=0)
    """How much each part repeats of the one before, so a word spoken across a cut is not
    lost. Removed again when the parts are stitched back together."""

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

    # --- The session cookie ------------------------------------------------

    def cookie_secure_for(self, scheme: str) -> bool:
        """Whether the cookie set on a request that arrived over ``scheme`` is marked ``Secure``.

        The scheme is the one the browser used: uvicorn rewrites it from ``X-Forwarded-Proto``
        only for a peer inside ``--forwarded-allow-ips``, so it can be raised to ``https`` by a
        proxy that was trusted and by nothing else. A client that forges the header is ignored
        rather than believed, which is why this is safe to read.
        """
        if self.session_cookie_secure == "auto":
            return scheme == "https"
        return self.session_cookie_secure == "true"

    def refuses_plain_http(self) -> bool:
        """Whether signing in over plain HTTP is refused rather than allowed to half-succeed.

        Only under ``true``, where the operator has said this instance is HTTPS. Accepting the
        password and answering with a cookie the browser is about to discard tells somebody their
        credentials were wrong when they were right -- and takes the password over the clear
        channel first, which is the part marking the cookie was never going to protect.
        """
        return self.session_cookie_secure == "true"

    # --- Normalisation -----------------------------------------------------

    @field_validator("session_cookie_secure", mode="before")
    @classmethod
    def _read_cookie_security(cls, value: object) -> object:
        """Read a boolean, or the spellings an environment variable writes one in.

        The setting used to be a plain boolean, so ``true``, ``1``, ``yes`` and ``on`` -- and their
        opposites -- have to keep meaning what they meant. Anything else is left alone for the
        ``Literal`` to refuse by name, which is a better error than a silent ``false``.
        """
        if isinstance(value, bool):
            return "true" if value else "false"
        if isinstance(value, str):
            spelling = value.strip().lower()
            if spelling in {"true", "1", "yes", "on"}:
                return "true"
            if spelling in {"false", "0", "no", "off"}:
                return "false"
            return spelling
        return value

    @field_validator("secret_key", mode="before")
    @classmethod
    def _an_empty_secret_is_no_secret(cls, value: object) -> object:
        """``SONARIUM_SECRET_KEY=`` means the operator has not set one.

        Pydantic reads an empty variable as a zero-length ``SecretStr``, which is not ``None`` and
        so walks past every ``is None`` guard in front of the signer -- and signs with the empty
        key rather than refusing. ``deploy/.env.example`` ships the variable exactly that way.
        """
        if isinstance(value, SecretStr):
            return None if not value.get_secret_value().strip() else value
        if isinstance(value, str) and not value.strip():
            return None
        return value

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

    def configuration_problems(self, *, require_secret: bool = True) -> ConfigurationReport:
        """Everything that can only be checked against the real machine.

        Split into what stops the instance and what is merely worth saying, because they are
        different questions: a missing signing key means playback cannot work at all, and no
        transcription endpoint means one feature is unavailable on an archive that otherwise
        runs. Reporting both at once is what lets an administrator fix their compose file once
        instead of restarting five times.
        """
        problems: list[str] = []
        advisories: list[str] = []

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
            advisories.append(
                "SONARIUM_TRANSCRIPTION_BASE_URL is not set, so no recording can be "
                "transcribed. Point it at a local faster-whisper server or an "
                "OpenAI-compatible endpoint."
            )

        return ConfigurationReport(fatal=tuple(problems), advisory=tuple(advisories))

    def prepare_directories(self) -> None:
        """Create the directories the instance writes to, before anything tries to.

        The temporary directory is one of them, and not obviously so. An upload is buffered
        there in full before the endpoint that stores it ever runs, so the image points
        ``TMPDIR`` inside the volume -- and a volume that predates that change does not have the
        directory. Creating it here rather than in the image is what keeps an upgrade from
        failing on the first upload instead of at startup.
        """
        if self.is_memory_database:
            return
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.resolved_database_path.parent.mkdir(parents=True, exist_ok=True)
        self.resolved_storage_dir.mkdir(parents=True, exist_ok=True)
        Path(tempfile.gettempdir()).mkdir(parents=True, exist_ok=True)


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
