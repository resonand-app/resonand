# v0 — the archive I use

The build plan for the **first version**, which has one job: to replace what I currently do with
my own audio. Publishing is not part of this milestone. Everything that comes after it lives in
[`ROADMAP.md`](../ROADMAP.md).

### The utility threshold

> I can put audio in, it gets transcribed, and I find one specific moment by searching across
> everything I have.

Anything that does not serve that sentence directly is not v0. Chasing summaries and AI features
in the first version would mean competing on ground that is already lost.

### The rule that governs this milestone

**Do not publish until it has run against the real archive for several months.** In this niche
credibility comes exclusively from the author using the tool, and the fastest way to destroy it is
to ship something that loses files. The repository stays private until the milestone in
[`ROADMAP.md`](../ROADMAP.md) is met; making it public is `REL-5`, at the end of that
milestone.

### What is cut, and what is not

The **data model stays whole** — rebuilding it later is far more expensive than carrying columns
nobody reads yet. Permission resolution stays exactly as specified, because it is cheap and it is
the foundation everything else stands on.

What is cut is surface: v0 ships with **local accounts only**, users created by hand by the
administrator, and **sharing at library level only**. Left out: OIDC, proxy-header authentication,
individual-recording sharing, ownership transfer (users with content simply cannot be deleted),
API tokens, MCP, manual transcript editing and LLM suggestions. Every one of those keeps its task
identifier and is listed in [`ROADMAP.md`](../ROADMAP.md).

---

## How to read this document

Every task has a **stable identifier** (`DAT-3`, `UI-7`…) that can be referenced from commits,
branches and issues. The prefix indicates the **work track**, not the phase. **Identifiers never
get renumbered** — a task deferred to `ROADMAP.md` keeps the number it has here.

| Prefix | Track | What it covers |
|---|---|---|
| `INF` | Repository infrastructure | Scaffolding, tooling, CI |
| `DEC` | Decisions | Open points that block code |
| `DAT` | Data and permissions | Schema, migrations, ACL, access layer |
| `API` | API and authentication | HTTP skeleton, sessions |
| `ING` | Ingestion and playback | Storage, ffprobe, waveform, streaming, integrity |
| `JOB` | Jobs, transcription and search | Queue, providers, segments, FTS5 |
| `UI` | Frontend | Every view in the interface brief |
| `OPS` | Operations | Docker, configuration, backup, observability |
| `INT` | Integration | Views that cross tracks: trash, administration, security |

Notation:

- `⇢ X, Y` — **depends on**. Cannot start until `X` and `Y` are done.
- `🔒` — **critical path**: until it is done, entire tracks are stalled.
- `🧪` — carries a mandatory test before it can be called done.
- `❓` — depends on a decision that is still open. **Nothing in this document carries it any
  more**; every decision the first version needs is settled below.

A task is done when it meets the criterion written next to it, not when it "works".

The schema, the permission query and the per-view interface brief that several tasks below refer
to live in a working specification kept out of this repository while the first version is being
built. Everything needed to understand *what* a task is and *why* it exists is here.

---

## Decisions

All of them settled. Nothing in the first version is waiting on a conversation.

| Topic | Decision | Consequence |
|---|---|---|
| Backend | Python 3.12 + FastAPI | First-class MCP SDK, `ffmpeg`/`ffprobe` are comfortable, home language |
| Database | SQLite + FTS5, migrations with Alembic | A single file, trivial backup |
| Frontend | React + TypeScript + Vite (SPA) | The persistent player forces an SPA |
| Licence | AGPL-3.0, no CLA | Nobody can offer a closed SaaS out of it without publishing their changes |
| Topology | **A single container**, in-process job worker | WAL + a single serialised writer. Can be split later without touching the schema |
| UI language | English as the base language, i18n from day one | No literal written inside a component. Shipping actual translations is a later milestone |
| Name and repository | `sonarium`, at `sonarium-app/sonarium`, private until publishable | `DEC-7`. Created and empty; the same string is the image name and the docs namespace |
| Visual identity | The **Archive** palette, light and dark, and nothing else | `DEC-8`. Tokens recorded below; no palette switcher ships |
| Audio egress | Nothing leaves the instance without a request, and watched folders only when explicitly configured to | `DEC-9`. Principle 2 made operational |
| Suggestions | No suggestion storage in the first migration | `DEC-1`, deferred with the AI features it serves |
| Timestamps | Instants in UTC; a recording's own time as wall clock plus offset | `DEC-11`. Two kinds of value, never mixed |
| Sessions | A `session` table, opaque id in the cookie | `DEC-12`. Revocation and the active-sessions list become real |
| Search coverage | Transcripts **and** titles, notes and tags, in one ranked list | `DEC-13`. A second FTS5 table in the first migration |
| Addressing | `uuid` in URLs, integer ids internal, **404 for unreadable** | `DEC-14`. A 403 confirms the resource exists |
| Identity keys | Normalised email; first writer owns a tag's display name | `DEC-15`. Unique key and display form kept apart |
| Duplicates | Hash match includes the trash, and says so | `DEC-16` |
| Default title | Filename without extension, cleaned, editable | `DEC-16` |
| Accepted formats | Audio, plus video containers kept whole with audio derived | `DEC-17`. The mp4 is often the one that matters |
| Transcription | Local `faster-whisper` behind an OpenAI-compatible server | `DEC-18`. Language optional per request, `null` = auto-detect |
| Waveform | Mono `int8` min/max pairs, fixed rate, version byte | `DEC-19` |
| Trash retention | 30 days, configurable per instance | `DEC-3` |
| Search grouping | Grouped under the recording, 3 shown, "+N more" | `DEC-4` |
| Export sidecar | JSON + derived `.vtt`/`.srt`, carrying the `uuid` | `DEC-5`. Re-import is idempotent |

`INF-8` transcribes each one into `docs/adr/`, one file per decision, so they can be revisited
together with their rationale rather than from memory. The subsections below carry the substance
that a one-line table row cannot.

### The name, claimed once (DEC-7)

`sonarium`, under the `sonarium-app` organisation: repository, container image, documentation
namespace and domain all carry the same string. The repository exists and is private.

There is prior use of the term in the same semantic field — a sound designer and recording
engineer working under this name, with a site and a presence on music platforms, plus a
discontinued mobile audio game. **The risk is accepted knowingly.** It is not a meaningful
trademark exposure, since a sound engineer's services and a piece of software are not the same
class, but it is a real discovery cost: competition for the term inside the same sector.

### The Archive palette (DEC-8)

One identity, not a palette switcher. *Paper and ink: a warm neutral with an indigo ink accent,
legible and sober over long sessions.* The other three proposals (Signal, Chamber, Tape) are kept
only as the record of how the choice was made.

Recorded here because `UI-1` needs it and the interface proposal itself is not published:

| Token | Light | Dark |
|---|---|---|
| `bg` | `#F4F2ED` | `#121210` |
| `surface` | `#FFFFFF` | `#1B1B18` |
| `surface2` | `#EAE7E0` | `#252521` |
| `border` | `#D9D5CC` | `#34342E` |
| `text` | `#1A1917` | `#F2F0E9` |
| `text2` | `#55524B` | `#A8A49A` |
| `text3` | `#8C887E` | `#6F6C64` |
| `accent` | `#2E3A8C` | `#9AA5F5` |
| `accentOn` | `#FFFFFF` | `#12132A` |
| `accentSoft` | `#E2E4F4` | `#22254A` |
| `wave` | `#2E3A8C` | `#9AA5F5` |
| `waveDim` | `#C3C7DE` | `#3B3F63` |
| `ok` | `#1E7A52` | `#4FBF8B` |
| `run` | `#B26A00` | `#E0A64A` |
| `err` | `#B3261E` | `#F2837C` |

Type scale: Instrument Serif for display, Instrument Sans for the interface, IBM Plex Mono for
timestamps and technical metadata. **No colour is hand-written in a component** — every one of
these is a token, and the dark values are a token redefinition rather than a second stylesheet.

### Watched folders and audio egress (DEC-9)

Principle 2 keeps its standing-configuration clause: a watched folder **may** request
transcription on arrival, but it is **opt-in per folder and disabled by default**, the
destination provider is named in the folder's configuration, and the administration view states
which folders send audio out and where. No folder transcribes because it happened to be created.

### What the first migration contains (DEC-11 to DEC-15)

`DAT-1` writes the schema from the specification **plus these five deltas**, each of which exists
because the specification promised something it had no storage for. They are listed together
because this is the artefact `DAT-1` needs, and because every one of them is expensive to add
afterwards.

1. **`session` table** (`DEC-12`) — `id`, `user_id`, `token_hash`, `created_at`, `last_seen_at`,
   `user_agent`, `ip`, `expires_at`, `revoked_at`. The cookie carries an opaque id and nothing
   else. `API-3` promises revocation and `UI-20` promises a list of active sessions; a stateless
   signed cookie can deliver neither. "Sign out everywhere" is one `UPDATE`.

2. **A second FTS5 table over an `audio` projection** (`DEC-13`) — title, notes and concatenated
   tag names, synchronised exactly the way `segment_fts` is. The interface brief promises search
   over titles, notes, tags *and* transcripts; only the last had an index. `LIKE '%x%'` cannot use
   one, and `UI-16`'s single ranked list needs both halves comparable. Retrofitting this means
   reindexing the whole archive.

3. **`library.uuid`** (`DEC-14`) — `library`, `category` and `tag` were addressable only by
   sequential integer id, which is enumerable in a multi-user instance. Public URLs and the API
   use `uuid`; integer ids stay internal. Adding the column later means a backfill *and* a URL
   change. Paired with a resolution rule, below.

4. **`user.email_normalised UNIQUE`** (`DEC-15`) — lowercased, with the typed form kept in `email`
   for display. `UNIQUE` on the typed address makes `Gabriel@x.com` and `gabriel@x.com` two
   accounts, and `DEC-2`'s OIDC linking would later compare against whichever casing happened to
   land first.

5. **`audio.recorded_at_offset`** (`DEC-11`) — nullable, in minutes. See the timestamp convention
   below.

Everything else in the specification's schema goes in unchanged, including the columns v0 never
reads: `api_token`, `transcript.derived_from`, `segment.speaker`, `share.audio_id`. The data model
stays whole.

### Timestamps (DEC-11)

Two kinds of value share the `TEXT` type and must never be treated alike.

- **Instants** — `created_at`, `deleted_at`, `job` times, session times. UTC ISO-8601 with
  milliseconds and a `Z` suffix, **fixed width**, so lexicographic order is chronological order
  and SQLite can sort them without parsing.
- **A recording's own time** — `recorded_at`. A local wall-clock ISO-8601 string, with
  `recorded_at_offset` in minutes when the offset is genuinely known and `NULL` when it is not.
  **Rendered as written, never converted.** A phone filename gives `2024-03-11 18:22` with no
  offset; normalise that to UTC and the recording shows as 17:22 to somebody abroad and shifts
  again across a DST boundary. A recording made at half six in the evening was made at half six in
  the evening, permanently.

### Addressing and refusals (DEC-14)

Public identifiers are `uuid`s. Anything the caller cannot read at level 10 returns **404, not
403** — a 403 confirms the resource exists, which is precisely the information the ACL is there to
withhold. This is a rule in `DAT-3`'s single entry point, not something each endpoint decides.

### Identity keys (DEC-15)

Both places that pair a unique key with a human display form keep them apart. Email is unique on
`email_normalised` and displayed from `email`. For tags the **first writer sets the display name**,
`slug` stays globally unique, and autocomplete always offers the canonical name — so somebody
typing *Física* against an existing *física* sees the existing one rather than silently renaming
it for everybody.

### Ingestion rules (DEC-16, DEC-17, DEC-19)

- **Accepted formats:** `.m4a`, `.mp3`, `.opus`, `.ogg`, `.oga`, `.wav`, `.flac`, `.aac`, `.amr`,
  `.3gp`, `.wma`, plus the video containers `.mp4`, `.m4v` and `.mov`. Video is **accepted and the
  container is kept whole** — principle 1 says the original is intact — with audio-only Opus
  derived for playback, and it is never presented as a video player. Refusing video would be the
  wrong call: the file with your grandmother in it is quite often the mp4.
- **Duplicates:** the hash match **includes trashed recordings**, and says so — *"a deleted copy of
  this file is in the trash. Restore it instead?"* Excluding them would let a restore produce a
  real duplicate. It stays a warning, never a silent block, and it only catches byte-identical
  files.
- **Default title:** the filename without its extension, lightly cleaned, always editable.
- **Waveform:** mono-mixed `int8` min/max pairs at a fixed number of peaks per second, behind a
  one-byte format version. Peaks are derived data and recomputing them is cheap — the version byte
  is what keeps it that way.

### Transcription (DEC-18)

The reference provider is a local **`faster-whisper` behind an OpenAI-compatible server**, with a
hosted OpenAI-compatible endpoint as the alternative path. That choice is what makes the utility
threshold reachable without sending the archive anywhere, and it sets `JOB-13`'s ceiling: a memory
and timeout limit locally, a 25 MB request limit on the hosted path, so chunking is required
either way.

**Language** is an optional per-request parameter, falling back to an instance default, with
`null` meaning auto-detect. It is part of the provider contract from the first implementation
rather than a parameter added later.

### Search behaviour (DEC-4, DEC-13)

One ranked list over both indexes. When a recording matches several times the results are
**grouped under the recording**, with the first three matches visible and a "+N more" that
expands — a flat list lets one long interview bury everything else. Recall against inflected
forms is `JOB-14`, which is measured rather than assumed.

### Retention and export (DEC-3, DEC-5)

- **Trash retention:** 30 days by default, configurable per instance, not per library.
- **Export sidecar:** one JSON per recording carrying all metadata and the full transcript, with
  `.vtt` and `.srt` derived from it, and timestamps following the convention above. It carries the
  original `uuid`, which makes **re-import idempotent**: importing a recording that is already
  present updates it instead of creating a second copy. Without that, the export round-trip in the
  exit criteria doubles the archive rather than verifying it.

### Suggestion storage, deferred (DEC-1)

Automatic category suggestion has no storage in the first migration. When it is needed it will be
a generic `suggestion` table (`entity`, `entity_id`, `kind`, `value`, `confidence`,
`confirmed_at`) rather than a `suggested_category_id` column on `audio` — which is precisely what
makes deferring it safe: a new table is a purely additive migration that touches no existing row,
whereas the column would have had to go into a hot table from the start. `audio_tag.source` stays
in the schema and keeps working for tags. Listed in [`../ROADMAP.md`](../ROADMAP.md) with the AI
features it serves.

---

## Phase map

```mermaid
graph TD
    F0["Phase 0 · Scaffolding<br/>INF"] --> F1["Phase 1 · Data and permissions<br/>DAT 🔒"]
    F1 --> F2["Phase 2 · API and auth<br/>API 🔒"]
    F2 --> A["Track A · Ingestion<br/>ING"]
    F2 --> B["Track B · Jobs and search<br/>JOB"]
    F2 --> C["Track C · Frontend<br/>UI"]
    F0 --> D["Track D · Operations<br/>OPS"]
    A --> F4["Phase 4 · Integration<br/>cross-cutting views"]
    B --> F4
    C --> F4
    D --> F4
    F4 --> V0["v0 · the archive I use"]
```

**How much parallelism there actually is**, by point in the project:

| Point | Work that can run in parallel… |
|---|---|
| Phase 0 | All of `INF` at once, and `OPS-1`/`OPS-2` can already be tackled |
| Phase 1 | Not much else: `DAT` is the bottleneck. In parallel: `UI-1`, `UI-2` (tokens and waveform, without real data), and `JOB-13`, which needs no schema |
| Phase 2 | `API` alongside `UI-3`/`UI-4` (client and shell against mocks) and `OPS` |
| Phase 3 | **Four full tracks at once**: `ING`, `JOB`, `UI`, `OPS` |
| Phase 4 | Everything converges; the cross-cutting tasks want two finished tracks |

---

## Where to start

Every decision the first version needs is settled, so **`INF-1` can start now** and nothing
upstream of it is waiting on a conversation.

The order that matters:

1. **`INF-1` → `INF-2` → `INF-3` → `INF-4` → `INF-5`.** Scaffolding and both toolchains, with
   pre-commit and CI failing identically in each. Then `INF-6` pushes to the remote, which is
   already attached.
2. **`INF-8`** in parallel, transcribing each decision above into `docs/adr/`, one file per
   decision. It is transcription, not fresh thinking — the reasoning is already written.
3. **`DAT-1`**, using **What the first migration contains** as its checklist. Nothing else in the
   project can be written first, and this is the one place where getting it wrong is expensive.
4. **`DAT-2` → `DAT-3`.** The ACL entry point, whose test matrix is the most important one in the
   repository.
5. From `API-2` onwards the four tracks open up and order stops mattering much.

Two things worth starting early because they need nothing from the schema: **`UI-1`/`UI-2`** (the
tokens and the waveform component) and **`JOB-13`** (chunking and timestamp re-stitching), which
is the highest-risk piece in the whole plan and the one most likely to need a second attempt.

## Phase 0 · Repository scaffolding

Short and mechanical, but it conditions everything that comes after. No product code.

- [ ] **INF-1** · Monorepo structure.
      ```
      backend/sonarium/{api,core,db,acl,media,jobs,transcription,mcp,cli}/
      backend/tests/
      frontend/src/{app,components,features,lib,i18n}/
      deploy/            docs/            scripts/
      ```
      *Done when:* `backend/` and `frontend/` install and start up empty, each with its own "hello".

- [ ] **INF-2** · Python tooling: `uv` for dependencies and environment, `ruff` (lint + format),
      `mypy` in strict mode, `pytest` + `pytest-cov`. ⇢ INF-1

- [ ] **INF-3** · Frontend tooling: Vite + React + strict TS, ESLint, Prettier, Vitest,
      Testing Library. ⇢ INF-1

- [ ] **INF-4** · `pre-commit` with both toolchains, failing identically locally and in CI. ⇢ INF-2, INF-3

- [ ] **INF-5** · CI on GitHub Actions: lint + typecheck + tests on both sides, plus a build of the
      Docker image. ⇢ INF-4

- [ ] **INF-6** · **Push to the remote.** `sonarium-app/sonarium` exists, is private and is
      empty; the local remote is attached and points at it through the `github.com-personal` SSH
      alias (key `id_rsa_personal`), never plain `github.com`.
      ```fish
      git push -u origin main
      ```
      *Done when:* `main` is on the remote and `gh repo view sonarium-app/sonarium` no longer
      reports the repository as empty.

- [ ] **INF-8** · `docs/adr/` with the decisions already made, one per file, with the discarded
      alternatives and the rationale.

---

## Phase 1 · Data and permissions core 🔒

**The bottleneck of the project.** Nothing that touches data can be written before it. The ACL
query is the only source of truth for permissions and everything goes through it.

- [ ] **DAT-1** 🔒 · Initial Alembic migration: the schema from the specification plus the five
      deltas listed under **What the first migration contains** — the `session` table, the metadata
      FTS5 table, `library.uuid`, `user.email_normalised` and `audio.recorded_at_offset`. Partial
      indexes, the composite FK `(category_id, library_id)` and the `share` `CHECK` included; none
      of it gets added "later". Timestamps follow the `DEC-11` convention from the first row
      written.

- [ ] **DAT-2** 🔒 · Connection layer: `PRAGMA journal_mode=WAL`, `foreign_keys=ON`,
      `busy_timeout`, `synchronous=NORMAL`. **A single serialised writer** inside the process;
      concurrent reads free. ⇢ DAT-1
      🧪 Load test that fires N simultaneous writes and checks that none gets `SQLITE_BUSY`.

- [ ] **DAT-3** 🔒 · **The ACL CTE** as the single entry point to `audio`. No other part of the code
      queries `audio` directly. ⇢ DAT-2
      🧪 Exhaustive test matrix: owner, library share, individual share, both at once (the highest
      wins), deleted library, deleted audio, disabled user. **This test is the most important one
      in the repository.** Individual sharing has no interface in v0, but the resolution is tested
      from day one.

- [ ] **DAT-4** · Repositories/queries for `library`, `category`, `tag`, `transcript`, `segment`,
      all with the required ACL level as a mandatory parameter. ⇢ DAT-3

- [ ] **DAT-5** · User creation → creates the non-deletable `is_personal = 1` personal library,
      within the same transaction. ⇢ DAT-4
      🧪 There must be no path that creates a user without a personal library.

- [ ] **DAT-6** · Tag normalisation (`slug` lowercase and without diacritics), **first writer
      owns the display name** on a slug collision, and **ACL-filtered** autocomplete offering the
      canonical name — tag names must not leak information between accounts. ⇢ DAT-4 🧪

- [ ] **DAT-7** · Category tree with `parent_id`: creation, rename, reorder and move, with cycle
      detection and per-level uniqueness. ⇢ DAT-4 🧪

- [ ] **DAT-8** · Development fixtures and seed: users, libraries shared with all three levels, and
      audios with and without a transcript. Serves both the tests and, later, the demo. ⇢ DAT-5

---

## Phase 2 · API skeleton and authentication 🔒

From the end of this phase onwards the four parallel tracks open up.

- [ ] **API-1** 🔒 · FastAPI skeleton: configuration through environment variables, uniform errors
      (`type`/`title`/`detail`), pagination, and published OpenAPI. ⇢ DAT-3

- [ ] **API-2** 🔒 · Authentication dependency that resolves the user and injects the ACL level into
      every endpoint. **No endpoint checks permissions on its own**, and anything unreadable
      returns **404 rather than 403**. ⇢ API-1, DAT-3 🧪

- [ ] **API-3** · Local accounts: login, cookie session (`HttpOnly`/`SameSite=Lax`) carrying an
      opaque `session` id, Argon2id hashing, password change, and revocation of one session or all
      of them. Registration is admin-only in v0. ⇢ API-2, DAT-1 🧪

- [ ] **API-7** · Bootstrap: the first user created is an administrator, who then creates the rest
      by hand. ⇢ API-3

- [ ] **API-8** · CRUD endpoints for `library`, `category`, `tag` and `share`, with the correct
      levels (sharing requires 30). Library-level shares only in v0; the endpoint shape already
      accepts `audio_id`. Libraries are addressed by `uuid`. ⇢ API-2, DAT-4 🧪

- [ ] **API-9** · CRUD endpoints for `audio` (metadata: title, notes, recording date, category,
      tags) at level 20. ⇢ API-8 🧪

---

## Phase 3 · Four parallel tracks

The four tracks only touch the `DAT` layer through `API-2`, so they can be developed
simultaneously without stepping on each other.

### Track A · Ingestion, storage and playback

- [ ] **ING-1** · Storage layout: `storage/<uuid[0:2]>/<uuid>/original.<ext>` with `derived.opus`
      next to it. The original stays **intact**, never rewritten. ⇢ API-1

- [ ] **ING-2** · Upload through the API: multipart with progress, configurable size limit, and
      resumption for large uploads (hours-long files), restricted to the format allowlist under
      **Ingestion rules**. ⇢ ING-1, API-9 🧪

- [ ] **ING-3** · Streaming SHA-256 hash during ingestion and **duplicate detection**: it warns and
      offers to continue, it never blocks silently. Byte-identical files only — a re-encoded copy
      of the same recording has a different hash, and the interface must not imply otherwise. The
      match **includes trashed recordings** and offers to restore instead. Title defaults to the
      filename without its extension. ⇢ ING-2 🧪

- [ ] **ING-4** · `ffprobe` → `duration_ms`, `sample_rate`, `channels`, `codec`, `mime`,
      `size_bytes`. Run as a job, not inline with the request. ⇢ ING-2, JOB-1

- [ ] **ING-5** · Waveform peak computation, stored in `audio.waveform` (compact BLOB, not JSON).
      It is the product's "thumbnail". Mono `int8` min/max pairs at a fixed rate, behind a
      one-byte format version. ⇢ ING-4 🧪

- [ ] **ING-6** · Transcoding to Opus into `derived_path` for browser playback, audio-only even
      when the original is a video container. ⇢ ING-4

- [ ] **ING-7** · **Authenticated streaming with `Range` (HTTP 206).** `<audio>` cannot send
      headers: session cookie or a short-lived signed token in the URL. ⇢ ING-6, API-3 🧪
      🧪 Seeking has to work for real: test partial and overlapping `Range` requests.

- [ ] **ING-8** · Download of the original with its original filename. ⇢ ING-7

- [ ] **ING-9** · *Watch folder*: watching a directory, automatic ingestion into a configured
      library and category, and moving the file to `processed/` or `failed/`. For voice notes this
      ends up being the main entry path. Transcription on arrival is **opt-in per folder and off
      by default**, with the destination provider named in the folder's configuration.
      ⇢ ING-3, JOB-1

- [ ] **ING-10** · Moving an audio between libraries: clears the category, changes who can see it,
      and **preserves the individual `share` rows**. Single transaction. The preservation clause has
      no visible effect in v0 and is implemented anyway, because retrofitting it is a data-loss bug.
      ⇢ API-9 🧪

- [ ] **ING-11** · CLI `sonarium import` (bulk, recursive, with `--dry-run`) and `sonarium export`
      (audio + a JSON sidecar carrying the `uuid`, all metadata and the full transcript, with
      `.vtt`/`.srt` derived). **Re-import is idempotent**: a recording already present is updated,
      not duplicated. ⇢ ING-3 🧪
      *This is principle 1. It ships in v0 even though nobody else will use it, because it is the
      promise the whole argument rests on and because adding it later always gets postponed.*

- [ ] **ING-12** · **Deriving `recorded_at`.** Recording date ≠ upload date, and nothing else
      populates it: `ffprobe` only returns technical metadata. Extract from, in order, container
      creation tags, the filename (`Recording 2024-03-11 18.22.m4a`, `PTT-20240311-WA0007.opus`,
      `AUD-20240311-…`), and filesystem mtime — recording which source was used, and leaving the
      field editable. Stored as wall clock plus `recorded_at_offset`, so a reading is never
      silently shifted into another timezone. ⇢ ING-4 🧪
      *Without this, every `recorded_at` in an imported archive of old voice notes is `NULL`, and
      the field, the sort order and the card decoration are all useless on day one.*

- [ ] **ING-13** · **`sonarium fsck`**: re-hash the stored originals against `audio.sha256`, report
      rows whose file is missing and files no row points at, and exit non-zero on any finding.
      Read-only; repairs are a separate explicit command. ⇢ ING-3, ING-11 🧪
      *This is principle 5 made checkable. The stated worst outcome for the project is shipping
      something that loses files; nothing else in the plan would notice if it did.*

### Track B · Job queue, transcription and search

- [ ] **JOB-1** 🔒 · In-process job worker: states `pending/running/done/failed/cancelled`, retries
      with exponential backoff, `idempotency_key`, and recovery of jobs left `running` across a
      restart. ⇢ API-1, DAT-2 🧪

- [ ] **JOB-2** · Transcription provider interface (**asynchronous** contract, never a synchronous
      call) and a provider registry driven by configuration. Carries **per-instance credentials and
      usage metering** — audio-seconds submitted, per user, per provider — from the first
      implementation, and a **language parameter** that is optional per request, falls back to an
      instance default and means auto-detect when `null`. ⇢ JOB-1
      *The provider interface is a future revenue surface, not an architecture detail. It does not
      get simplified to save work, and a credit-based service without metering is a rewrite.*

- [ ] **JOB-3** · OpenAI-compatible `/v1/audio/transcriptions` provider, verified against a local
      `faster-whisper` server as the reference deployment and against a hosted endpoint as the
      alternative. ⇢ JOB-2, JOB-13 🧪

- [ ] **JOB-6** · Transcript model: **always segments** with `start_ms`/`end_ms` and a `speaker`
      field present even if diarisation is not implemented. Plain text, subtitles and synchronised
      highlighting are derived from the segments; never the other way round. ⇢ JOB-2, DAT-4 🧪

- [ ] **JOB-7** · Several transcripts per audio: re-transcribing creates a new row, only one has
      `is_active = 1`, and switching the active one is atomic. ⇢ JOB-6 🧪

- [ ] **JOB-9** · FTS5 indexes: synchronisation of `segment` → `segment_fts` and of the
      title/notes/tags projection (triggers or explicit writes, but one of the two and documented),
      plus a `sonarium reindex` command that rebuilds both. ⇢ JOB-6, DAT-1 🧪

- [ ] **JOB-10** · Search endpoint with the ACL applied inside the query, `snippet()` for the
      highlighted fragment, transcript and metadata matches in **one ranked list**, and results
      **grouped under the recording** with three matches shown and a "+N more".
      ⇢ JOB-9, DAT-3 🧪
      🧪 Test that a user does **not** find transcript text they are not allowed to see.

- [ ] **JOB-11** · Search filters: library, date range, duration range, tags, and transcription
      status. ⇢ JOB-10

- [ ] **JOB-13** 🔒 · **Chunking long audio, and re-stitching the timestamps.** The
      OpenAI-compatible endpoint caps requests at 25 MB, and compatible local servers impose their
      own memory and timeout ceilings; the anchor use case is a forty-minute interview and the
      daily one is an hour of driving. Split on silence with an overlap, submit the parts, and
      **offset every returned segment by its part's start**, de-duplicating the overlap.
      ⇢ JOB-2 🧪
      🧪 A synthetic three-hour file must come back as one continuous transcript whose segment
      timestamps still line up with playback at the end of the file, not only at the start.
      *Without this, v0 fails on exactly the recordings that motivated the project.*

- [ ] **JOB-14** · **Search recall decision and implementation.** `unicode61 remove_diacritics 2`
      gives accent-insensitivity but no stemming: *factory* will not find *factories*, and in
      Catalan and Spanish the inflected forms are where most queries land. Options: append a prefix
      wildcard to the trailing query token, add a secondary FTS5 `trigram` index for substring
      matching, or accept the limitation and document it. ⇢ JOB-10 🧪
      🧪 A recall fixture of real inflected queries against a real transcript, so the chosen
      behaviour is measured rather than assumed.
      *The whole promise is a three-second search. This is a decision to take, not to discover.*

### Track C · Frontend

`UI-1`/`UI-2` can start during Phase 1, and `UI-3`/`UI-4` against mocks during Phase 2.

- [ ] **UI-1** · Design system for the **Archive** palette recorded above: colour tokens,
      light and dark mode, typographic scale (Instrument Serif / Instrument Sans / IBM Plex Mono),
      spacing and radii. **No colour hand-written in a component**, and no palette switcher — dark
      mode is a token redefinition, not a second theme.

- [ ] **UI-2** · **Waveform component** — the product's signature visual element: bar and stroke
      variants, card / list / large player sizes, played vs pending state, and click to seek.
      ⇢ UI-1

- [ ] **UI-3** · API client generated from the OpenAPI spec (`openapi-typescript`), with shared
      types. ⇢ API-1
      *This is what keeps the interface a client of the API rather than a privileged path into it.*

- [ ] **UI-4** · Navigation shell: header with global search, sidebar with libraries and shared
      libraries, and mobile collapse. ⇢ UI-1, UI-3

- [ ] **UI-5** · **Persistent player**: it survives view changes, and a decision on whether the
      large player and the compact one are the same component in two states or two synchronised
      components (*recommendation: a single global state, two presentations*). Integration with the
      **Media Session API** for system controls on mobile. ⇢ UI-2, UI-4

- [ ] **UI-6** · **View A · Library grid**: header with owner, shares, count and total duration;
      audio card with the **four transcription states visually distinguishable**, category, tags
      with overflow, and a play button on the card. ⇢ UI-5, API-9

- [ ] **UI-7** · **View A' · Dense compact list** — for 800 audios the grid is useless. Fixed-height
      row, virtualised. ⇢ UI-6

- [ ] **UI-8** · Filters and sorting: category tree, tags as pills, transcription status toggles,
      and sorting by recording date / upload date / duration / title. ⇢ UI-6, DAT-6, DAT-7, ING-12

- [ ] **UI-9** · Multiple selection and bulk actions: assign category, add tag, move between
      libraries, send to trash. ⇢ UI-7

- [ ] **UI-10** · Grid states: empty (an invitation to upload, not a sad drawing), loading
      (skeletons), and error. ⇢ UI-6

- [ ] **UI-11** · **View B · Detail** with a large player and a seekable waveform, 0.75×–2× speed
      and ±15 s skips. ⇢ UI-5, ING-7

- [ ] **UI-12** · **Synchronised transcript** — the central moment of the product: the active
      segment is highlighted as it plays, clicking a segment seeks to that moment, and the scroll
      follows playback without hijacking the user's manual scrolling. ⇢ UI-11, JOB-6

- [ ] **UI-13** · Metadata panel, inline-editable according to permission, technical metadata
      collapsed, and a **read-only state that clearly reads as non-editable without looking
      broken**. ⇢ UI-11, API-9

- [ ] **UI-14** · Transcript selector when there is more than one (model, language, date, which one
      is active). `JOB-7` makes re-transcription possible, so without this it is unreachable from
      the interface. The manual editor is a later milestone. ⇢ UI-13, JOB-7

- [ ] **UI-15** · Transcription states in the detail view: missing (with a call to action), in
      progress (with progress if the provider offers it), and **failed with the real error message
      and a retry button** — the error explains what happened and what to do, it does not
      apologise. ⇢ UI-13, JOB-2

- [ ] **UI-16** · **View C · Search**: transcript results with a context fragment, a timestamp, and
      playback from that exact point **without opening the detail view**. Several matches in one
      recording are grouped under it, three shown, "+N more" expands. ⇢ UI-5, JOB-10

- [ ] **UI-17** · **View D · Library and sharing**: edit name and description, manage the category
      tree, a panel with who has access, at what level, who granted it and when, and the level
      selector **explained in plain language**. Library-level grants only in v0. ⇢ UI-4, API-8

- [ ] **UI-18** · **View E · Upload dialog**: drag and drop, multiple files, per-file progress,
      destination (library + category), the transcription request from `UI-25`, handling of hash
      duplicates and unsupported formats, and **an upload that is not lost when switching tabs**.
      ⇢ UI-4, ING-2, ING-3, UI-25

- [ ] **UI-19** · **View F · Move audio dialog** — its own design, because it has non-obvious
      consequences. It must explicitly warn that it will change who can see the audio and that the
      category will be lost. ⇢ UI-13, ING-10

- [ ] **UI-20** · **View G · Profile**: name, email, avatar, language, theme, password change and
      active sessions. Tokens are not in v0. ⇢ UI-4, API-3

- [ ] **UI-21** · **View J · Authentication**: local sign-in, and the first-run screen that creates
      the initial administrator. ⇢ API-3, API-7

- [ ] **UI-22** · i18n plumbing: English as the base, **every literal externalised**, localised date
      and duration formatting. Shipping actual translations is a later milestone; making them
      possible without touching components is v0. ⇢ UI-4

- [ ] **UI-23** · Accessibility as the floor: visible keyboard focus, `prefers-reduced-motion`
      respected, AA contrast, full keyboard navigation of the player and the transcript.
      ⇢ UI-12 🧪 axe audit on every view.

- [ ] **UI-24** · A real mobile-first pass: much of the consumption happens on a phone, with
      headphones, on the move. Gestures, touch target sizes, and the player coexisting with the
      system controls. PWA installability and offline behaviour are a later milestone. ⇢ UI-23

- [ ] **UI-25** · **External transcription disclosure** — principle 2 made visible. Wherever a
      transcription is requested, the interface names **which provider the audio will be sent to**
      and that it will leave the instance, before the request is made; per `DEC-9`, the
      administration view says the same thing for every watched folder configured to transcribe on
      arrival. No silent egress anywhere, including the retry path. ⇢ UI-13, JOB-2 🧪
      *This is the one principle with no other implementing task. Without it, principle 2 is a
      sentence in a document rather than a property of the software.*

### Track D · Operations and deployment

- [ ] **OPS-1** · Multi-stage `Dockerfile`: frontend build, backend with `ffmpeg`, final image
      without the toolchain, non-root user. ⇢ INF-1

- [ ] **OPS-2** · Example `docker-compose.yml` with volumes for the database and the storage, plus a
      documented `.env.example`. ⇢ OPS-1

- [ ] **OPS-3** · Configuration **through environment variables only**, validated at startup with
      useful messages (not a stack trace). ⇢ API-1

- [ ] **OPS-4** · **Subdomain and subpath** support (`/sonarium`), both tested behind a reverse
      proxy. In v0 because retrofitting a base path into an SPA is genuinely painful, and the
      subpath is the one that always ends up broken. ⇢ OPS-2, UI-4 🧪

- [ ] **OPS-5** · `/healthz` and `/readyz`, and structured logs with request correlation. ⇢ API-1

- [ ] **OPS-7** · Automatic migrations at startup with locking, and a documented rollback path.
      ⇢ DAT-1, OPS-1

- [ ] **OPS-6** · **Backup and restore that are actually exercised.** A consistent copy of the
      SQLite database in WAL mode (`VACUUM INTO`) without stopping the service, plus what to copy
      from `storage/`. ⇢ OPS-2 🧪
      🧪 Restore into a clean container and assert the archive is complete, and upgrade a populated
      database from the previous migration revision and assert nothing was lost. Formal
      cross-version documentation is a later milestone; during v0 I am upgrading my own real
      archive continuously, which is when these break.

---

## Phase 4 · Integration and cross-cutting views

Everything that needs two finished tracks at once.

- [ ] **INT-1** · **View I · Trash**: deleted audios and libraries with the time they have left,
      restore and delete now, against a 30-day default retention. Permanent deletion requires
      **typed confirmation**. ⇢ UI-9, API-8 🧪

- [ ] **INT-2** · Scheduled trash purge at the configured retention (30 days by default, per
      instance), as a recurring job, also deleting the files from `storage/`. ⇢ INT-1, JOB-1 🧪

- [ ] **INT-3** · **View H · Administration**, visually separated so nobody wanders into it by
      accident: users (list, create, disable — **deleting a user with content is refused in v0**,
      with a message saying why), transcription provider (configuration, connection test, status),
      job queue (pending, running, failed, retry, cancel), and system status (space used, audio
      count, index size). ⇢ UI-20, API-7, JOB-1

- [ ] **INT-5** · Security pass: signed URLs, size limits, login rate limiting, and verification
      that **no endpoint has escaped `API-2`**. ⇢ every track 🧪
      🧪 Test that enumerates every route and fails if any of them skips the ACL.

- [ ] **INT-6** · End-to-end tests (Playwright) of the paths that matter: upload → transcribe →
      search → play from the result; share a library → the other user sees it at the correct level;
      move between libraries → who can see it changes. ⇢ INT-5

---

## When is v0 done

Not when the checkboxes are ticked. When all of these hold:

1. **My real archive is in it** — imported, transcribed, searchable — and I have stopped using
   what I used before.
2. **A second real person uses it.** One family member, one shared library, actual usage on a
   phone. The retention layer is what justifies the entire multi-user architecture, and until
   somebody who did not build it uses it, that justification is theoretical and the permission
   model is validated only by its own tests.
3. **`ING-13` has run clean** against the real archive after at least one upgrade, and
   **`OPS-6`'s restore has been performed for real**, not just tested in CI.
4. **`ING-11`'s export round-trips**: export the whole archive, import it into an empty instance,
   and get the same thing back.
5. **Several months have passed** with all of the above true.

Only then does the milestone in [`ROADMAP.md`](../ROADMAP.md) begin.
