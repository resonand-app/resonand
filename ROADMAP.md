# Sonarium — roadmap

What comes **after** the first version. The build plan for the first version is
[`docs/v0-plan.md`](docs/v0-plan.md); why any of it exists is [`VISION.md`](VISION.md).

Task identifiers (`API-4`, `UI-29`…) are stable and are never renumbered: a task listed here is
one that was deferred out of the first version, and it keeps the number it had.

**There are no dates anywhere in this document.** A long roadmap with dates is a promise a
one-person project cannot keep, and breaking it costs more credibility than never having made it.

---

## Milestone 1 · The archive someone else can install

The first version has one job: to replace what I do today with my own audio, privately. This
milestone has a different one: to go from *working* to *installable and maintainable by somebody
who is not me*. It ends with the first public release, tagged `v0.1.0`, and with the repository
made public.

Nothing here starts until the first version's exit criteria are met — my real archive is in it, a
second real person uses it, the integrity check runs clean after an upgrade, the export
round-trips, and several months have gone by with all of that true.

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

### Actually installable

- **INF-10** · `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates, and
  `SECURITY.md` with a contact address. Deliberately not done earlier: community scaffolding
  before there is anything to contribute to is furniture in an empty room. *Was `INF-9` until the
  repairs task in `docs/ui-plan.md` turned out to hold that number and to have shipped under it.*
- **OPS-8** · Publishing the image to GHCR from CI, with `latest` and per-version tags.
- **OPS-9** · **Cross-version migration matrix**: upgrade a populated database across every
  released revision, not just the previous one, in CI. The uncounted metric for this whole project
  is whether instances survive upgrades.
- **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
- **UI-28** · Real PWA quality on mobile: installability, offline shell, and behaviour on a flaky
  connection with headphones in.
- **UI-36** · Shipping actual translations. The plumbing is in the first version (`UI-22`); this is
  the part where Catalan, and then others, genuinely exist.
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
- **REL-5** · Semantic versioning, `CHANGELOG.md`, the `v0.1.0` tag with the published image, and
  making the repository public.

### Open decision for this milestone

- **DEC-6** · **Companion transcription container.** The principle that the application does not
  transcribe is correct as architecture, but requiring the user to configure a provider is an
  enormous barrier for the non-technical audience this milestone is meant to reach. The way out
  that does not break the principle is an **optional companion container** with a local engine,
  separate from the application, consumed through the same provider interface as anything else. It
  still does not transcribe, but it works without configuring anything.
  **This conditions the packaging in `OPS-11`, so it has to be decided before it.**

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
  before the service exists, not after. `JOB-2` already carries the metering this would need.
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
