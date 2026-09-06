"""What the API sends and accepts.

These are the shapes ``UI-3`` generates its typed client from, so they are part of the product
rather than an internal detail. Two rules hold throughout:

* **Public identifiers are ``uuid``s.** An integer id never leaves the process, except for
  categories and tags, which are only reachable through a library the caller can already read.
* **A recording's own time leaves as it was written** -- a wall-clock string and a separate
  offset in minutes, never merged into an instant, because merging them is what makes a recording
  made at half six in the evening show as half five to somebody abroad (``DEC-11``).
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from sonarium.core import colours
from sonarium.core.colours import Colour
from sonarium.core.levels import Level

_EMAIL_SHAPE = re.compile(r"^[^@\s]+@[^@\s]+$")


def _an_address(value: str) -> str:
    """Check the shape of an address, and nothing more.

    Deliberately not full RFC validation. An address here is an identity key -- the
    application sends no mail -- and the strict validators reject the reserved top-level
    domains, which is precisely where a self-hosted instance lives: an account on a homelab
    is quite legitimately ``someone@nas.local``, and refusing it would be this software
    telling somebody their own network is wrong.
    """
    cleaned = value.strip()
    if not _EMAIL_SHAPE.match(cleaned):
        raise ValueError("An email address needs a local part and a domain, as in a@b.")
    return cleaned


EmailAddress = Annotated[str, AfterValidator(_an_address), Field(max_length=320)]


class Api(BaseModel):
    """Base for everything that goes over the wire."""

    model_config = ConfigDict(from_attributes=True, extra="forbid")


# --- Accounts -------------------------------------------------------------


class UserSummary(Api):
    """Somebody the caller can see: themselves, or a person a library is shared with."""

    id: int
    display_name: str
    email: str


class Me(Api):
    """The signed-in account."""

    id: int
    display_name: str
    email: str
    is_admin: bool


class SignIn(Api):
    email: EmailAddress
    password: str = Field(min_length=1)


class Bootstrap(SignIn):
    """The first run: an account and its display name, in one step (``UI-21``)."""

    display_name: str = Field(min_length=1, max_length=200)


class ChangePassword(Api):
    current_password: str
    new_password: str = Field(min_length=10)


class CreateAccount(Api):
    """Registration is administrator-only in v0."""

    email: EmailAddress
    display_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=10)
    is_admin: bool = False


class SessionSummary(Api):
    """One of the account's sign-ins (``UI-20``)."""

    id: int
    created_at: str
    last_seen_at: str
    expires_at: str
    revoked_at: str | None
    user_agent: str | None
    ip: str | None
    is_current: bool


class InstanceState(Api):
    """What the sign-in screen needs to know before anybody has signed in (``UI-21``)."""

    name: str
    version: str
    needs_bootstrap: bool
    """True only while the instance has no accounts at all: the first user is an administrator."""


# --- Libraries ------------------------------------------------------------


class LibrarySummary(Api):
    uuid: str
    name: str
    description: str | None
    is_personal: bool
    owner: UserSummary
    level: Level
    """What the caller may do with it, resolved by the ACL rather than guessed by the client."""

    colour: Colour
    """``DEC-8``: the colour the user picked for it, one of seven. It identifies the library and
    carries no meaning."""

    audio_count: int
    total_duration_ms: int
    deleted_at: str | None


class CreateLibrary(Api):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    colour: Colour = colours.DEFAULT


class UpdateLibrary(Api):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    colour: Colour | None = None


class ShareSummary(Api):
    """Who has access, at what level, granted by whom and when (``UI-17``)."""

    grantee: UserSummary
    level: Level
    level_description: str
    granted_by: int
    created_at: str


class CreateShare(Api):
    grantee_id: int
    level: Level


# --- Categories and tags --------------------------------------------------


class CategorySummary(Api):
    id: int
    parent_id: int | None
    name: str
    position: int


class CreateCategory(Api):
    name: str = Field(min_length=1, max_length=200)
    parent_id: int | None = None


class UpdateCategory(Api):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    parent_id: int | None = None
    clear_parent: bool = False


class ReorderCategories(Api):
    ordered_ids: list[int]


class TagSummary(Api):
    id: int
    name: str
    slug: str


class TagSuggestion(Api):
    tag: TagSummary
    uses: int
    """How many of the caller's own recordings carry it. Nobody else's are counted."""


# --- Recordings -----------------------------------------------------------


class AudioSummary(Api):
    """A recording as the grid and the list draw it (``UI-6``, ``UI-7``)."""

    uuid: str
    title: str
    notes: str | None
    recorded_at: str | None
    recorded_at_offset: int | None
    recorded_at_source: str | None
    created_at: str
    duration_ms: int | None
    library_uuid: str
    category_id: int | None
    tags: list[TagSummary]
    level: Level
    transcription_state: str
    """``none`` | ``running`` | ``done`` | ``failed`` -- the four states the card distinguishes."""

    has_waveform: bool
    is_shared_individually: bool
    deleted_at: str | None


class AudioDetail(AudioSummary):
    """Everything the detail view shows, including the technical metadata it keeps collapsed."""

    original_filename: str | None
    mime: str | None
    size_bytes: int | None
    sha256: str | None
    sample_rate: int | None
    channels: int | None
    codec: str | None
    uploaded_by: UserSummary


class UpdateAudio(Api):
    title: str | None = Field(default=None, min_length=1, max_length=500)
    notes: str | None = None
    recorded_at: str | None = None
    recorded_at_offset: int | None = None
    category_id: int | None = None
    clear_category: bool = False
    tags: list[str] | None = None


class MoveAudio(Api):
    """Its own shape because it has consequences the caller has to have been told about."""

    library_uuid: str


class DuplicateWarning(Api):
    """A byte-identical file that is already here (``DEC-16``)."""

    uuid: str
    title: str
    in_trash: bool
    library_uuid: str


# --- Transcripts ----------------------------------------------------------


class SegmentOut(Api):
    idx: int
    start_ms: int
    end_ms: int
    speaker: str | None
    text: str


class TranscriptSummary(Api):
    id: int
    is_active: bool
    source: str
    provider: str | None
    model: str | None
    language: str | None
    created_at: str
    segment_count: int


class TranscriptDetail(TranscriptSummary):
    segments: list[SegmentOut]


# --- Search ---------------------------------------------------------------


class SearchMatch(Api):
    """One place a query matched inside one recording."""

    kind: str
    """``transcript`` or ``metadata`` -- both halves of one ranked list (``DEC-13``)."""

    fragment: str
    """The surrounding text with the term marked, from SQLite's own ``snippet()``."""

    start_ms: int | None
    """Where to play from. ``None`` for a metadata match, which has no moment."""


class SearchResult(Api):
    """A recording, with the matches inside it grouped under it (``DEC-4``)."""

    audio: AudioSummary
    matches: list[SearchMatch]
    total_matches: int
    """Three are shown and the rest are behind "+N more": a flat list lets one long interview
    bury everything else."""


# --- Administration -------------------------------------------------------


class JobSummary(Api):
    """One piece of background work, as the administration view lists it (``INT-3``)."""

    id: int
    kind: str
    state: str
    attempts: int
    audio_uuid: str | None
    error: str | None
    created_at: str
    started_at: str | None
    finished_at: str | None
    ready_at: str | None
    """When a pending job becomes eligible again, which is what a backoff looks like from
    outside."""


class TranscriptionDestination(Api):
    """Where audio goes, readable by anybody who can ask for a transcription (``API-12``).

    Deliberately the narrowest thing that answers the question. The full ``ProviderStatus``
    stays administrator-only; this one is what ``UI-25``'s disclosure is drawn from, and a
    disclosure only some people can read is not one.
    """

    provider: str
    host: str | None
    """Host and port, without any userinfo. ``None`` when nothing is configured."""

    is_local: bool
    """Whether it is on the instance's own network. It is what lets the notice choose between
    saying so calmly and stating plainly that audio leaves. Pessimistic: anything that cannot be
    placed is reported as not local."""

    configured: bool


class ProviderStatus(Api):
    """Whether transcription is configured and whether it answers.

    The credential is never included, in any form. What an administrator needs to know is
    whether one is set, not what it is.
    """

    provider: str
    model: str
    base_url: str | None
    has_credential: bool
    default_language: str | None
    configured: bool
    reachable: bool | None
    """``None`` until a connection test has been run, because nothing should reach out to a
    third party just because somebody opened a page (principle 2)."""

    detail: str


class StorageStatus(Api):
    """What the archive is using."""

    recordings: int
    trashed_recordings: int
    libraries: int
    total_duration_ms: int
    originals_bytes: int
    derived_bytes: int
    database_bytes: int
    free_bytes: int | None


class SystemStatus(Api):
    """Everything the administration view shows about the instance itself."""

    version: str
    database_revision: str | None
    expected_revision: str | None
    storage: StorageStatus
    jobs: dict[str, int]
    transcription: ProviderStatus
    trash_retention_days: int
