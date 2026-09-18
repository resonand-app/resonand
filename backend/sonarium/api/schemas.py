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
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

from sonarium.core import colours
from sonarium.core.colours import Colour
from sonarium.core.levels import Level
from sonarium.core.states import TranscriptionState

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


class AdminUser(Api):
    """An account as administration lists it (``API-20``, ``INT-3b``).

    Beside :class:`UserSummary` rather than replacing it. That one is what a share and
    ``API-15``'s lookup answer with, so ``is_admin`` on it would tell any library manager who runs
    the instance -- the same leak the lookup is deliberately narrow to prevent. This shape is
    answered by the ``/admin/users`` routes and nowhere else.

    ``disabled_at`` rather than a boolean: "disabled since March" is a fact the row has, and
    "disabled" is a fact it does not.
    """

    id: int
    display_name: str
    email: str
    is_admin: bool
    disabled_at: str | None
    created_at: str


class Me(Api):
    """The signed-in account."""

    id: int
    display_name: str
    email: str
    is_admin: bool
    language: str | None
    """The language this person chose, or ``None`` to follow the instance's. It is about the
    person and follows them to their phone; **theme is not here**, because that is about the
    screen being looked at and lives in browser storage (``DEC-8``)."""


class UpdateMe(Api):
    """What somebody may change about their own account (``API-13``).

    Every field defaults to "leave this alone", so the interface can save one section of the
    settings view without sending back the ones it is not editing. Password is not here: it needs
    the current one and ends every other session, which is a different operation.
    """

    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailAddress | None = None
    language: str | None = Field(default=None, max_length=35)
    clear_language: bool = False
    """Go back to following the instance's language. ``None`` already means "leave it alone", so
    clearing needs to be asked for -- the same shape as ``UpdateCategory.clear_parent``."""


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
    """What the interface needs to know about the instance itself (``UI-21``, ``API-14``).

    Everything here is a fact about the instance rather than about a person, which is why this
    is the one endpoint answered without a session. None of it is a secret: the version is
    already published, and the rest is what somebody would find out by trying.
    """

    name: str
    version: str
    needs_bootstrap: bool
    """True only while the instance has no accounts at all: the first user is an administrator."""

    trash_retention_days: int
    """How long a trashed thing can still be brought back. It was on the administrator-only
    status endpoint, so ``INT-1``'s "time left" could not be shown to anybody else -- which is
    everybody who most needs to know it."""

    max_upload_bytes: int
    accepted_extensions: list[str]
    video_extensions: list[str]
    """``UI-18a`` states the size limit and the formats **before** somebody picks a file, and is
    told to read them here rather than hard-code them. Video containers are listed separately
    because the dialog says they are kept whole and played as audio (``DEC-17``)."""


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


ShareSource = Literal["library", "audio"]
"""Where a grant was made. A ``share`` row carries a library or a recording, never both."""


class ShareSummary(Api):
    """Who has access, at what level, granted by whom and when (``UI-17``)."""

    grantee: UserSummary
    level: Level
    level_description: str
    granted_by: int
    created_at: str
    source: ShareSource
    """Whether this grant is on the library or on the one recording (``API-22``).

    A recording's panel draws the two differently and can revoke only the second, so the
    distinction is the API's rather than something the interface infers from which list it asked
    for -- both arrive in one.
    """


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


class TranscriptFeatures(Api):
    """What a transcript is, as distinct from where it came from (``TRX-12``).

    ``provider``, ``model`` and ``language`` on the summary say which engine was asked. These say
    what came back. They are read from the transcript rather than from the instance's current
    configuration on purpose: the configured engine changes while transcripts persist, and the
    selector shows the old and the new one side by side.
    """

    task: str
    """``transcribe`` | ``translate``."""

    has_speakers: bool
    speaker_count: int
    speakers_are_comparable: bool
    """Whether one label means one person throughout. False where the audio was submitted in
    parts, because an engine names speakers per request (``TRX-13``)."""

    granularity_ms: int | None
    """The median segment duration. How precisely a click on a line can seek."""

    stitched_from: int | None
    """How many parts the audio was submitted in. ``None`` for a transcript written before this
    was recorded, which is not the same as one submitted whole."""


class TranscriptSummary(Api):
    id: int
    is_active: bool
    source: str
    provider: str | None
    model: str | None
    language: str | None
    created_at: str
    segment_count: int
    features: TranscriptFeatures


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


class TranscribeRequest(Api):
    """Ask for a recording to be transcribed (``API-11``)."""

    language: str | None = Field(default=None, max_length=35)
    """A BCP 47 tag, or ``None`` to let the provider detect it -- ``JOB-2``'s contract."""


class TranscriptionStatus(Api):
    """What is happening to a recording's transcription, for whoever can read the recording
    (``API-17``, ``UI-15``).

    ``transcription_state`` on the recording says which of the four states it is in and nothing
    more, which is enough for a badge and not enough for a screen: ``UI-15b`` says how long it has
    been running and which attempt this is, and ``UI-15c`` shows **the real error text**. Those
    three facts live on the job, and the job was only readable through the administrator-only
    queue -- so on a shared instance the person whose recording had failed was the one person who
    could not be told why.

    It reports the newest transcribe job and nothing about any other kind of work: the probe that
    could not read a file is a different failure with a different remedy, and ``INT-3d``'s queue is
    where an operator sees all four.
    """

    state: TranscriptionState
    """The recording's state, from :mod:`sonarium.core.states`, so this endpoint and the badge
    cannot disagree."""

    attempts: int
    """How many times it has been tried. ``0`` before the first attempt starts, and what
    ``UI-15b`` shows only once it is above one."""

    started_at: str | None
    """When the current attempt began, which is what "started 4 minutes ago" is counted from.
    ``None`` for a job that is queued and has not run yet -- including one waiting out its
    backoff, which is a wait rather than an elapsed time."""

    error: str | None
    """Why the last attempt failed, as the provider said it. Shown rather than replaced: an error
    that explains is worth more than one that apologises (§1.9)."""


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
    """Whether anything answered. ``None`` until a check has been run, because nothing should
    reach out to a third party just because somebody opened a page (principle 2)."""

    usable: bool | None
    """Whether it can produce what the archive stores, which is a different question and the one
    that decides whether transcription works. An endpoint can answer everything asked of it and
    still run a model that cannot return timed segments (``TRX-10``). ``None`` until checked."""

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
