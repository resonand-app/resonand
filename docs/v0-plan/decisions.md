# Decisions

`DEC-*` — the decisions that had to be settled before code could be written, and the reasoning
that settled them. This is the track the code cites most: a comment saying `DEC-11` means the
rule is written down here rather than remembered. The second half was taken later, when the
interface was specified against the backend as built.

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
| Visual identity | The **Sonarium design system**, vendored at `frontend/design-system/` | `DEC-8`. Signed off and final; no palette switcher ships |
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
| Sharing one recording | Manage may grant it onwards; listing who has access takes manage | `DEC-25`. `granted_by` keeps a chain legible; an inherited row names the library |

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

### The design system (DEC-8)

**Settled, and the artefact is in the repository.** The system is vendored at
[`frontend/design-system/`](../../frontend/design-system/README.md): tokens, components, the mark,
the Chillax webfont, seventeen specimen cards and a click-through app kit. Its `README.md` is the
system in prose and is the authority — what follows is only enough to know what was decided,
because a plan should not restate a stylesheet.

This **supersedes the *Archive* palette** — a warm neutral with an indigo ink accent, Instrument
Serif / Instrument Sans / IBM Plex Mono — and the interface proposal that carried it. Both have
been retired; neither is an input to anything. The direction was chosen from four built candidates
and the specimen boards are kept for the record under `docs/internal/design/provenance/`.

What it decides:

- **One chromatic family: orange.** `--orange-300…900`, 400 as the accent on dark and 700 on
  light, every step declaring the on-colour that clears AA against it. A played waveform, a
  primary button and an active nav item are visibly the same signal. **It was amber until
  `UI-40`**, when the brand settled on `#E98A5F` and the family was rotated 19 degrees toward red
  — every step keeping its saturation and lightness, so what moved is the hue and not the ramp
  that was signed off. `clay` moved with it, held apart from the accent on saturation rather than
  hue because a library swatch announces its own name.
- **Two neutral ramps.** `--ink-*` (blue-black) for dark, `--paper-*` (warm) for light, aliased
  through semantic names that flip on `[data-theme="light"]`. **Dark is the default and light is a
  full peer** — a token redefinition, never a second stylesheet.
- **Three type families, three jobs.** *Chillax* 600 for the wordmark and the one page title per
  screen and nothing else, ever. *Geist* for the interface. *Geist Mono*, tabular, for anything
  comparable to another number — durations, timestamps, counts, speed.
- **Elevation, not borders.** Panels float in a 12px gap on three steps of shadow. No gradients,
  no textures, no glass, no imagery. The waveform is the only graphic the product owns and it is
  real data.
- **The waveform**, at five sizes exactly — 20 dense row, 38 library card, 52 recording card,
  34 player, 130 audio detail — as amplitude in rounded bars, minimum bar height equal to bar
  width so silence stays a row of dots rather than disappearing. Drawn from the peaks `ING-5`
  stores; **until that job has run there is no waveform**, only a dashed rule and a duration.
- **Library colour**, user-chosen from seven muted hues. It identifies a library and carries no
  meaning; it is never derived from the name or the audio. This is what `library.colour` in
  `DAT-1` exists for.
- **Lucide** at 1.7px stroke, on a 24px grid, as the icon set.

**No colour is hand-written in a component**, and no palette switcher ships: the user chooses
light, dark or follow-the-system, and nothing else.

Two things the system ships as compromises, both of which `UI-1` closes:

- **Geist is fetched from Google Fonts and Lucide from a CDN.** A self-hosted archive that phones
  out to render its own interface is the wrong shape, and it breaks in an air-gapped deployment.
  Both get bundled.
- **The icons are a substitution.** The specimen board's glyphs were drawn for the exploration and
  Lucide replaced them, so the system ships a complete maintained set rather than a partial
  hand-drawn one. `Icon` is the only file that changes if that is ever revisited.

Where anything *goes* is not this system's job. Navigation, routes and every view with its real
fields, states and actions are in the interface specification kept alongside the working
specification, out of this repository while the first version is being built.

### Watched folders and audio egress (DEC-9)

Principle 2 keeps its standing-configuration clause: a watched folder **may** request
transcription on arrival, but it is **opt-in per folder and disabled by default**, the
destination provider is named in the folder's configuration, and the administration view states
which folders send audio out and where. No folder transcribes because it happened to be created.

Nothing in the first version watches a folder, so this binds no shipped code. It binds `ING-9`,
scoped in [`docs/next-plan/ingestion.md`](../next-plan/ingestion.md), and it is recorded in this
version's plan because this is where it was settled — a folder built without it is the one way
principle 2 gets lost quietly.

### What the first migration contains (DEC-8, DEC-11 to DEC-15)

`DAT-1` writes the schema from the specification **plus these seven deltas**, each of which exists
because something was promised elsewhere with no storage behind it. They are listed together
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
   for display. `UNIQUE` on the typed address makes `Alex@x.com` and `alex@x.com` two
   accounts, and `DEC-2`'s OIDC linking would later compare against whichever casing happened to
   land first.

5. **`audio.recorded_at_offset`** (`DEC-11`) — nullable, in minutes. See the timestamp convention
   below.

6. **`library.colour`** (`DEC-8`) — `TEXT NOT NULL DEFAULT 'stone'`, one of the seven names the
   design system defines (`amber`, `clay`, `slate`, `moss`, `stone`, `plum`, `teal`), validated by
   a `CHECK`. The design system identifies a library by a colour the user picks, in the sidebar,
   on the library card and on the create dialog — and it is explicit that the colour is *chosen*,
   never derived from the name or the audio. Without a column there is nowhere to put the choice,
   and hashing the `uuid` into a hue would make it unchangeable, which is a different product
   decision taken by accident. It is a one-word column on a table with a handful of rows; the
   alternative is a migration plus a backfill later for no gain.

7. **`user.language`** (`DEC-8`) — nullable, a BCP 47 tag, `NULL` meaning follow the instance
   default. `UI-22` makes translation possible without touching a component and `UI-20` offers the
   control from v0 with English as its only entry, which is what proves the round trip works before
   there is a translation to lose. **Theme deliberately gets no column**: it is a property of the
   screen somebody is looking at rather than of the person, and "follow the system" is already a
   per-device idea, so it lives in browser storage. `API-13` is what reads and writes this.

Everything else in the specification's schema goes in unchanged, including the columns v0 never
reads: `api_token`, `transcript.derived_from`, `segment.speaker`, `share.audio_id`. The data model
stays whole — and `library.colour` and `user.language` are carried here for exactly that reason,
since a column nobody reads yet is far cheaper than a migration plus a backfill later.

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
- **Export layout:** one directory per recording, named for its `uuid`, holding the original, the
  sidecar and the subtitles. Two recordings that arrived under the same filename cannot overwrite
  each other, and no punctuation in a filename can separate a sidecar from its audio (`ING-11a`).

### Suggestion storage, deferred (DEC-1)

Automatic category suggestion has no storage in the first migration. When it is needed it will be
a generic `suggestion` table (`entity`, `entity_id`, `kind`, `value`, `confidence`,
`confirmed_at`) rather than a `suggested_category_id` column on `audio` — which is precisely what
makes deferring it safe: a new table is a purely additive migration that touches no existing row,
whereas the column would have had to go into a hot table from the start. `audio_tag.source` stays
in the schema and keeps working for tags. Listed in [`ROADMAP.md`](../../ROADMAP.md) with the AI
features it serves.

---


## Decisions this plan takes

### DEC-20 · The frontend libraries

Chosen once, here, so no task chooses again.

| Concern           | Choice                                                                                 | Why this one                                                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build, dev server | **Vite 8** + React 19 + TypeScript strict                                              | Already the decision in this plan and already written into the commented Dockerfile stage                                                              |
| Routing           | **React Router 7**, declarative mode                                                   | Eight routes, and §2.1 puts real state in the URL — the query, the filters, the view mode. Query-param handling is the requirement, not loaders                |
| Server state      | **TanStack Query 5**                                                                   | Every list endpoint is `limit`/`offset` with a `total`; caching, invalidation after a mutation, and a known total before the rows arrive are exactly its shape |
| Client state      | **Zustand 5**                                                                          | Three stores that outlive a route: playback, the upload tray, toasts. `UI-5` asks for one playback state with two presentations; a store is that sentence      |
| Virtualisation    | **TanStack Virtual 3**                                                                 | 36px rows over 800 recordings, and a few hundred transcript segments                                                                                           |
| i18n              | **i18next** + react-i18next                                                            | `UI-22` wants every literal externalised and a pseudo-locale for the +30% check                                                                                |
| Icons             | **lucide-react**                                                                       | Replaces the CDN UMD build and its `createIcons` effect. Bundled, tree-shaken, no outbound request                                                             |
| Fonts             | **Fontsource's** Geist and Geist Mono, vendored                                        | Both faces as subset woff2. Closes the Google Fonts `@import` that `UI-1` was already told to close                                                            |
| Tests             | **Vitest** + Testing Library + jsdom; **axe-core** in both                             | Mirrors the backend's arrangement: the same checks locally and in CI                                                                                           |
| Test doubles      | **MSW 2**                                                                              | The API is real by the time views are built, but a view test must not need a running instance                                                                  |

Nothing here is a framework. Everything is replaceable one file at a time, which is the property
that matters for a project that intends to be maintained by one person for years.

**The row said Vite 6 when this was signed.** By the time `INF-3a` installed it, Vite 6 was the
registry's `previous` tag and 8 was `latest`; Vitest had reached 5 and ESLint 10. The table now
says what actually landed, because a decision record that disagrees with `package-lock.json` is
worse than no record. The exact versions live in the lock file, which is the only place a version
should be written twice.

**The Tests row also said Playwright, for `INT-6`.** That task was decided against rather than
deferred: the path it covers includes transcription, which a pipeline can only reach through a
fake provider, and against a fake provider the run proves the wiring rather than the threshold.
Nothing was ever installed for it — Playwright appears in `package-lock.json` only as an optional
peer that `vitest` declares and nothing selects — so the row now describes what is in
`package.json` rather than retracting a dependency.

**The fonts row said the `geist` package, and that package is the wrong object.** It ships TTF
and no woff2 — 169 KB and 171 KB for the two variable faces, against 84 KB for all four files
that landed — and it peer-depends on `next >=13.2.0`, because it exists to hand a descriptor to
Next.js's font loader rather than to produce a stylesheet. `UI-1a` vendors
`@fontsource-variable/geist` and `@fontsource-variable/geist-mono` instead: the same upstream
fonts, subset to Latin and Latin Extended and compressed. **They are copied in rather than
depended on**, because `tokens/fonts.css` is read two ways — Vite processes it for the app, and
the seventeen cards in `guidelines/` `<link>` it off disk with no bundler — and only a relative
`url()` works in both. The version they came from is written in that file, which is the one place
somebody bumping them will be looking.

The one thing that is a ceiling rather than a choice: **TypeScript is 6.0.3 and not 7.**
TypeScript 7 is the Go port, and `typescript-eslint` peer-requires `typescript >=4.8.4 <6.1.0` —
so `INF-3b`, which needs `typescript-eslint`, decides this and not preference. Revisit when
`typescript-eslint` supports it; nothing else in the stack is holding it back.

### DEC-21 · The design system is TypeScript, in place

`frontend/design-system/` **becomes the application's component source**, converted from `.jsx` to
strict `.tsx` where it stands. The hand-written `.d.ts` files fold into the components they
document; the `.prompt.md` files stay, because they are the only record of when not to use a
component. A generated `index.ts` barrel is added — the adherence config that shipped with the
system already forbids reaching into `components/**` and mandates importing from a barrel that was
never authored.

The alternative was `UI-1`'s literal wording: keep the system as a `.jsx` design artifact and port
it into `src/components/ui/`. That produces two copies of twenty-one components with no mechanism
to keep them in step, and the design tool commits nothing upstream, so the re-syncability it would
buy does not exist. `DEC-8` said one system, versioned with the code. This is that.

`UI-1`'s stated scope survives intact: every component, self-hosted Geist, bundled Lucide, and a
test that fails on a hex colour in a component. It said thirty-two; the count is thirty-four, and
`INF-9` is where that gets fixed at the source.

### DEC-22 · Presentational in the system, data-bound in the app

The composites the prototype invented split on one line: **if it can be rendered from props alone
it belongs in `frontend/design-system/`; if it holds a query, a mutation or a store it belongs in
`frontend/src/components/`.** So `Shell`, `PageHeader`, `StateSlot`, `AvatarStack`, `KeyValueList`
and `ToastRegion` join the system. `FilterBar`, `BulkBar`, `UploadTray` and `ResultGroup` do not —
they are application components built out of system primitives.

Without this line, "make it reusable" ends with the design system importing TanStack Query.

### DEC-23 · The phone shell is built from prose

The prototype draws the desktop shell only. The phone shell — four bottom tabs, the docked player
strip that expands, the filter sheet, the metadata sheet — exists as §2.3's prose and ASCII
diagrams plus the `Sheet` component, which was drawn specifically to unblock it. It is built from
that, and `UI-4f`, `UI-5f`, `UI-8e`, `UI-13f` and `UI-24a` are where the phone layout gets decided
in code rather than in a picture. If any of them turns out to need a drawing first, stop and get
one; a phone layout guessed at 375px is cheaper to draw than to rewrite.

### DEC-24 · The API is mounted under `/api`

`UI-4a` was told to settle the namespace before naming a route, and this is the settlement.

The API is mounted at the root, so the interface's routes and the API's paths are one namespace
and the API was there first. `/search?q=…` — §2.1's search route — _is_ `GET /search`, and a hard
refresh on it answers the endpoint rather than the shell. `backend/tests/api/test_spa.py` already
asserts that, deliberately, so it could not be rediscovered later.

`UI-4a` offered two ways out and preferred the cheaper: rename the colliding client route. **This
plan takes the other one.** Every API path moves under `/api` (`API-16`), and §2.1's eight routes
are built exactly as specified.

The reason is that renaming `/search` fixes one collision and leaves the arrangement that produced
it. `/libraries`, `/audio`, `/trash`, `/tags`, `/instance`, `/auth`, `/users`, `/admin` and
`/transcription` are nine top-level names the interface can never be given, and every endpoint
added after this one takes another. A view named after the thing it shows is the normal case, so a
namespace where that is sometimes forbidden — for a reason nobody can see from the route table —
costs more over the life of the project than one prefix costs now.

It is also the last cheap moment. `UI-3a` commits an `openapi.json` snapshot carrying every path,
and a build that fails when the backend renames a field is the point of it; renaming every path
afterwards means regenerating the snapshot and reviewing a diff that touches every line of it.

What does not move: `/healthz` and `/readyz`, which are probes rather than API surface and are
already outside the document; and `/`, which is the interface when a bundle is present and the
instance's own answer when it is not.
