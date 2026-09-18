# Sonarium — roadmap

What comes **after** the first version. The build plan for the first version is
[`docs/v0-plan/`](docs/v0-plan/); why any of it exists is [`VISION.md`](VISION.md).

Task identifiers (`API-4`, `UI-29`…) are stable and are never renumbered: a task listed here is
one that was deferred out of the first version, and it keeps the number it had.

**There are no dates anywhere in this document.** A long roadmap with dates is a promise a
one-person project cannot keep, and breaking it costs more credibility than never having made it.

---

## Milestone 1 · The archive someone else can install

The first version has one job: to replace what I do today with my own audio, privately. This
milestone has a different one: to go from *working* to *installable and maintainable by somebody
who is not me*. It ends with the first public release, tagged `v0.1.0`.

Nothing here starts until the first version's exit criteria are met — my real archive is in it, a
second real person uses it, the integrity check runs clean after an upgrade, the export
round-trips, and several weeks have gone by with all of that true and nothing going wrong in
them.

### The rest of the multi-user model

- **DEC-2** 🔒 · **Local ↔ OIDC account linking** with the same email: merge automatically,
  reject, or require confirmation from the account that already exists.
  *Recommendation:* reject by default and offer explicit linking from the profile, with a
  `SONARIUM_OIDC_AUTO_LINK` deployment flag for single-family instances. Automatic merging by
  email is a privilege escalation if the OIDC provider does not verify the email.
  **Blocks `API-4`.**
- **API-4** ❓ · OIDC: authorization code + PKCE, mapping `sub` → `oidc_subject`, and whatever
  linking policy `DEC-2` decides. ⇢ DEC-2
- **API-5** ⚠ · Proxy header authentication (Authentik/Authelia), **mandatorily tied to a list of
  trusted proxy IPs**, disabled by default. Without the IP restriction this is a total
  authentication bypass, so it ships with a test proving a request that carries the headers from
  an untrusted IP is rejected.
- **API-6** · Personal access tokens: creation, `scopes`, `library_scope`, expiry, `last_used_at`,
  revocation. The value is shown **exactly once** and only its hash is stored.
- **API-7b** · OIDC administrator designation: an explicit way to name admins in deployments where
  no local account is ever created (environment variable with `sub` values or emails). ⇢ API-4
- **API-23** · **The library a recording is in, named on the recording.** `AudioDetail` carries
  `library_uuid` and the interface resolves the name against `GET /libraries`, which holds only
  while every readable recording sits in a readable library. An individual grant breaks that by
  design, and the breadcrumb, the player's label and the move dialog all read it. ⇢ API-22
- **INT-4** · **User deletion with mandatory ownership transfer**: it shows how many libraries and
  how many audios are being transferred and to whom before confirming, and resolves the personal
  library too. Until this exists, the first version simply refuses to delete a user with content.
  🧪 No library may be left orphaned and no `owner_id` may point at a non-existent user.
- **INT-7** · Registration policy (open / invite-only / admin-only) and invitations.
- **UI-26** · Token management screen. The freshly created token must make it **unmistakable** that
  the value is shown only once. ⇢ API-6
- **UI-27** · OIDC on the sign-in screen, with both paths visible when both are enabled and without
  OIDC looking like a footnote. ⇢ API-4
- **UI-30a** · **The sharing panel on a recording**, which has to **visually distinguish access
  inherited from the library from access granted on this specific recording**: inherited rows
  read-only and named as inherited, individual rows editable. `SharePanel` is already shaped for
  it (`UI-17e`) and takes a target rather than a library. Revoking states the consequence in
  numbers as it does today, but the honest sentence is a different one — revoking an individual
  grant may leave the person with access anyway, through the library. ⇢ API-22, API-23, UI-17c
- **UI-30b** · **Shared with me**, the destination a recording shared on its own is reachable
  from. An individual grant deliberately does not grant its library, so such a recording appears in
  no library, no sidebar entry and no route: today it is reachable only by search or by its URL.
  `GET /api/audio` already answers it and the interface has never called it. ⇢ UI-30a, UI-4d

### The API as a product

This is the point of the project and what separates it from everything else in the category — and
it only makes sense once the API is stable enough that tools built on it do not break.

- **MCP-1** · MCP server **over HTTP with a token**, not stdio: this is a multi-user application.
  ⇢ API-6, INT-5
- **MCP-2** · Read tools: search transcripts, read a recording's transcript, list libraries and
  categories, read metadata. **Text and metadata, never raw audio.** ⇢ MCP-1
- **MCP-3** · Write tools behind an explicit scope: edit metadata, add tags, request transcription.
  ⇢ MCP-2
- **MCP-4** 🧪 · **Structural test**: every MCP tool must be a thin wrapper over an existing REST
  endpoint. If a tool needs logic of its own, the API is badly designed and the API gets fixed,
  not the tool. ⇢ MCP-3

### Transcription beyond one provider

- **JOB-4** · Webhook provider: the application publishes the file behind a signed URL and the
  service returns the result to an authenticated callback endpoint. Subject to the same disclosure
  rule as every other egress path (`UI-25`).
- **JOB-5** · Upload-and-wait provider, polling against `external_id`.
- **JOB-8** · Manual transcript editing → creates a transcript with `derived_from` pointing at the
  original, which is **always kept**.
- **UI-29** · The editor for `JOB-8`, which has to make it clear that **a derived copy is created
  and the original is kept**. ⇢ JOB-8, UI-14

The `TRX-*` findings that did not make v0 keep their identifiers from
[`docs/v0-plan/transcription.md`](docs/v0-plan/transcription.md), where the ones that did are
written up with the decisions governing all of them.

- **TRX-2** · The poll loop, and the queue state a submitted job waits in. The contract is
  submit-and-poll, but the worker calls `poll()` once and raises if there is no result, and none of
  the queue's five states means *submitted to the provider, come back later*. A worker and queue
  change rather than a contract change — recorded here so the contract does not get reopened to fix
  it. `external_id` is also written only in `finish()`, so the field whose whole purpose is to
  survive a restart is never written while a restart could matter. ⇢ JOB-5
- **TRX-4** · Normalise granularity at the boundary: accept native segments, utterances or words,
  and group up to segments in one place. Segments-only is the right invariant and does not move;
  enforcing it by *refusing* anything not already segment-shaped is what excludes every engine
  whose finest unit is the word. This is what widens the market past the Whisper family. ⇢ TRX-3
- **TRX-5** · Wire the usage sink, or delete the module. `metering.py` is complete and correct,
  both call sites build a provider without a sink, and so nothing is metered and
  `UsageRecord.outcome` only ever says `submitted`. Either is defensible; existing and doing
  nothing is the one state that is not. It matters on the day `DEC-10` is considered, which is
  exactly the day it is too late to start collecting.
- **TRX-6** · Five trust classes where there are now two. "External" collapses a box the operator
  rents and controls, an EU-resident provider with zero retention contracted, and a US cloud that
  may train on the input — and for the credibility layer that distinction *is* the decision. Not an
  assessment of anybody's compliance: somewhere for the operator to declare what they have
  contracted, shown where the audio leaves. ⇢ TRX-15
- **TRX-9** · Say plainly why an untimed engine is declined. Wyoming — the Home Assistant voice
  ecosystem, which is precisely the homelab audience [`VISION.md`](VISION.md) names — returns text
  with no timestamps and cannot satisfy this archive. Somebody already running
  `wyoming-faster-whisper` will reasonably expect to point Sonarium at it, and what they get today
  is a connection error against a port that does not speak HTTP.
- **TRX-11** · Seams duplicate speech when segments are coarse. `restitch` keeps a segment by its
  midpoint and the seam sits in the middle of a three-second overlap, so a segment whose *span*
  crosses the seam survives in both parts and the speech inside the overlap appears twice. A
  fragment at sentence scale; up to three seconds at every cut against an engine returning
  thirty-second segments. The overlap is sized for word-scale run-up, and once `TRX-3` declares
  granularity it can be sized for what is actually coming back. ⇢ TRX-3
- **TRX-14** · Several engines in one instance, routed by the recording's **declared** language
  (`TRX-D5`), and an engine whose task is to translate rather than to transcribe. Needs a
  recording-level language — there is nothing between the instance default and the per-request
  parameter today — and makes the destination endpoint answer per recording and per task rather
  than per instance (`TRX-D8`). ⇢ TRX-3, TRX-15
- **TRX-15** · Configuration in the interface rather than the environment, with sensitive values
  encrypted at rest under a key that stays outside the database (`TRX-D7`). The provider is built
  once at startup and held for the worker's life, so this is also where that becomes a per-job
  resolution. ⇢ TRX-12
- **TRX-16** · Translations as their own class, distinct from versions (`TRX-D6`), with the
  vocabulary to match: "v1 / v2 / show this one" is version language and says nothing useful about
  a translation. ⇢ TRX-14

### Actually installable

- **INF-10** · `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates, and
  `SECURITY.md` with a contact address. Deliberately not done earlier: community scaffolding
  before there is anything to contribute to is furniture in an empty room. *Was `INF-9` until the
  repairs task in the interface plan turned out to hold that number and to have shipped under it.*
- **OPS-8** · Publishing the image to GHCR from CI, with `latest` and per-version tags.
- **OPS-9** · **Cross-version migration matrix**: upgrade a populated database across every
  released revision, not just the previous one, in CI. The uncounted metric for this whole project
  is whether instances survive upgrades.
- **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
- **UI-28** · Real PWA quality on mobile: installability, offline shell, and behaviour on a flaky
  connection with headphones in.
- **UI-40** · Shipping actual translations. The plumbing is in the first version (`UI-22`); this is
  the part where Catalan, and then others, genuinely exist.
  *Was `UI-36` until the lockup shipped under that number, with a test and commits citing it. The
  shipped one keeps it, exactly as `UI-31` did in `INF-9`. That this is the second time this
  document has handed out a number the plan was already using is the argument for the plan being
  the only place that mints them.*
- **REL-1** · The README's screenshots — two of them, light and dark. Interface quality is the one
  claim that cannot be verified from a list, which is exactly why it gets shown rather than
  asserted.
- **REL-2** · User documentation: installation, transcription provider configuration, backup and
  restore, and **how to leave the product** — the full export, documented as a supported path
  rather than an escape hatch.
- **REL-3** · Public API documentation and a token guide. ⇢ MCP-4
- **REL-4** · Demo instance. **Synthetic data only** (`DAT-8`), with uploads disabled or wiped on a
  schedule — a writable public demo is first-party hosting of other people's voice at small scale,
  which the project has deliberately declined. A good recording of the real thing is an acceptable
  substitute.
- **REL-5** · Semantic versioning, `CHANGELOG.md`, and the `v0.1.0` tag with the published image.
  *Making the repository public belongs here again. It was taken out and done ahead of the release
  on the reasoning that the code and the plan are worth reading before there is anything to
  install; that is reversed, and the rule now gating both is in
  [`docs/v0-plan/`](docs/v0-plan/) — the repository opens when the first version's tasks are
  closed, the release when it has run against a real archive for several weeks.*
- **REL-6** · **The README stops describing a project being built and starts describing the first
  version**, and this document is brought level with it: every task still open in
  [`docs/v0-plan/`](docs/v0-plan/) at that point either ships or is moved here keeping its
  identifier, so that a reader arriving at the repository the day it opens finds one account of
  what exists rather than three. The status block is the part that has drifted furthest — it still
  says the interface is being built, which stopped being true before the cross-cutting pass — and
  `REL-1`'s screenshots land in the same pass, because a README describing a finished interface
  and showing none is the same problem in the other direction. ⇢ REL-1

### Open decision for this milestone

- **DEC-6** · **Companion transcription container.** The principle that the application does not
  transcribe is correct as architecture, but requiring the user to configure a provider is an
  enormous barrier for the non-technical audience this milestone is meant to reach. The way out
  that does not break the principle is an **optional companion container** with a local engine,
  separate from the application, consumed through the same provider interface as anything else. It
  still does not transcribe, but it works without configuring anything.
  **This conditions the packaging in `OPS-11`, so it has to be decided before it.**

---

## Asked for while using it

Written down as they came up, in the order they stopped being tolerable rather than any order of
value. **None of them carries an identifier**, deliberately: [`docs/v0-plan/`](docs/v0-plan/) is
where a number is minted, and a number that exists only in this document is one the plan will
hand out twice — which has now happened to `UI-31` and again to `UI-36`. Each of these gets one
when it is scheduled, and not before.

Three things on the list turned out to be somewhere already. **Editing a transcript** is `JOB-8`
and `UI-29` above. **A mobile application** is `UI-28`, and the entry under *Beyond that* that
says why it stays a PWA until that is disproved. And **uploading from a library that is empty** is
not a wish but a defect — it is `UI-18a1` in the first version, because `UI-10a`'s empty state
already promises an invitation it has no way to accept.

### Transcription, and what comes back from it

- **More than one transcriber**, perhaps one per language, chosen per recording or per library
  instead of per instance. `TRX-3` is what makes this describable: an engine already declares what
  it can do, so the open question is only which of several to ask.
- **Segments that break on sentences rather than on clock time.** What comes back is bounded by the
  engine's own windowing, so this is a stitching decision on this side of the boundary — the
  transcript reads as prose while the timing stays fine enough to seek with.
- **The fragment length as configuration**, checked against what a model actually accepts. Worth
  noting that `TRX-3` deliberately moved this the other way, the engine declaring its ceiling and
  the worker cutting to it, so this is a setting that overrides a declaration and has to say what
  happens when the two disagree.
- **What a transcription cost**: how long it took, which model answered, which engine. The
  `transcript` row already carries `task` and `stitched_from`; this is the rest of that provenance.
- **Recordings marked never to transcribe** — music, ambience, a sound kept for its own sake. It
  also stops the queue spending on things nobody will ever search.
- **Recordings with no speech in them**, which is the same question from the other end: today they
  come back empty and are indistinguishable from a failure. Deciding what an empty transcript
  *means* is the task.

### Inside a transcript

- **Parts of a recording attached to ideas**, so a moment can be named and returned to.
- **Those ideas organised** within the transcript rather than left in a flat list.
- **Two readings of one transcript**: continuous prose, and segment by segment. The segments are
  the stored form (`JOB-6`), so both are views over the same rows rather than two formats.
- **Exporting one recording's transcript from the interface.** `ING-11` already writes `.vtt` and
  `.srt` beside an export, so what is missing is the gesture and not the format.

### Sharing

- **Suggestions while sharing**, instead of typing a full address. `API-15` is deliberately narrow
  — full normalised email, at most one result — precisely because a directory of everybody on the
  instance is what it exists to prevent. So this is a decision about what a manager may see, not a
  widening of the lookup.
- **Sharing a transcript without the audio.** That is a real separation in the permission model
  rather than a flag on a share: a level that reads text but not bytes does not exist today.
- **Telling somebody that something was shared with them.** There is no notification surface at
  all; `REV-12`'s event stream is the seam one would arrive on.

### A library and its furniture

- **Category management that is pleasant to use.** The tree itself is `DAT-7` and works; the screen
  is the part nobody enjoys.
- **Colours chosen freely for a library**, rather than the seven `DEC-8` fixed. Worth weighing
  against the reason they were fixed: seven named colours are a vocabulary, and a free picker is a
  way to end up with two libraries nobody can tell apart.
- **Tags with colours of their own.**
- **A library's settings in two blocks** rather than one column.

### Working through a lot of recordings at once

- **Sending to transcribe from the list**, not only from inside a recording.
- **The bulk actions in the main header** once a selection exists, rather than behind a menu — the
  trash especially, which is the one everybody reaches for first.
- **Emptying the trash in bulk**, which today is one row at a time.
- **Favourites**, kept with a heart.

### The recording itself

- **Editing the large title in place**, rather than only the field in the panel beside it.
- **Looping or stopping at the end, as a setting**, stopping by default.
- **A waveform whose shape somebody can choose.**
- **The list view's headers rounded.** It is the one screen that still looks like a table.
- **On a phone, the metadata panel closed on arrival**, so that the recording is what is on screen.

### Accounts, and what comes in

- **A profile picture.**
- **Refusing an upload that has no duration**, which is otherwise a file that fails three jobs
  later and gives nobody a reason why.
- **Where a recording was made**, when the container already carries it. This one is different in
  kind from everything above and is listed last on purpose: location is the most sensitive thing a
  voice note carries, it is frequently present in phone recordings without the person having
  thought about it, and reading it is a decision about what this archive keeps rather than a
  feature to add. If it ever ships, it ships as something visible and removable — never as a
  column quietly filled in at ingest.

---

## Beyond that · Intentions, not commitments

Conditional, undated, and listed here mostly so they do not sneak in early and distort a decision
that is being taken now.

- **Semantic search**, alongside the existing full-text search rather than replacing it.
- **DEC-1** · **Suggestion storage.** Deliberately not in the first migration, because it only
  exists to serve AI features that are themselves undated. When it is needed: a generic
  `suggestion` table (`entity`, `entity_id`, `kind`, `value`, `confidence`, `confirmed_at`), which
  also covers suggested titles and recording dates, rather than a `suggested_category_id` column
  on `audio`. A new table is purely additive, which is what makes deferring it free.
- **JOB-12** · Automatic classification: suggested tags with `source = 'llm'` and category
  suggestion through `DEC-1`. **Always a suggestion, never applied directly.** `audio_tag.source`
  already exists and already works for tags; only the category half is missing.
- **Summaries**, with a configurable provider, under the same egress disclosure rule as
  transcription.
- **Mobile application with capture.** This is the only item that changes the positioning — the
  project is a destination and not a recorder, and it stays that way until the archive is mature
  enough that being a recorder as well is an addition rather than a distraction.
- **Public share links.**
- **DEC-10** · **A paid first-party transcription service.** The day it exists, the project becomes
  a processor for the audio flowing through it: processing agreement, security obligations, breach
  notification, sub-processor management. There are design answers — audio held transiently and
  never stored, or delegation to a third party under its own contract — but they have to be chosen
  before the service exists, not after. `JOB-2` carries the *interface* this would meter through;
  the sink that would store the rows is deliberately deferred until something reads them, so the
  table is part of this item rather than already paid for.
- **Speaker identification**, only under the design condition in [`VISION.md`](VISION.md): the same
  pattern as transcription, an optional module consuming a service the user configures, never
  integrated into the application. Biometric identification is an Annex III high-risk category
  under the AI Act, and the free-software exemptions do not cover high-risk systems.
- **INT-8** · Administrator tooling for data-subject requests: everything involving one person
  exported in one action, and a hard delete that bypasses trash retention. The project is not the
  controller — the administrator is — but recital 78 is what decides whether a professional can use
  the tool at all, and this is the concrete form that takes.

---

## Out of scope

Written down so they do not come back in through the side door. **None of them may condition a
schema decision before it has been explicitly discussed.**

Not now, possibly later:

- Recording from the browser.
- Speaker diarisation. The `speaker` field is reserved from the first migration and left empty.
- More than one level of the category tree in the interface. `parent_id` supports the tree in the
  database from day one.
- Per-user or per-library storage quotas. A family instance will eventually want them; nothing is
  designed for them yet.
- Near-duplicate detection. Hash matching catches byte-identical files only, and audio recovered
  from messaging apps arrives re-encoded — so the duplicates that most need catching are exactly
  the ones it misses.
- S3 or S3-compatible storage.
- A native mobile application. The PWA should be enough; `UI-28` is what proves or disproves that.

Never, because they would make it a different product:

- Audio editing.
- A podcast player.
- A music library manager.
- **A transcription engine inside the application.** This is the non-goal that defines the project
  rather than limiting it.
- First-party hosting of other people's archives. Holding somebody else's voice turns a project
  into a company, with liability over sensitive data and an availability obligation.
