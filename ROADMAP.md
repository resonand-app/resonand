# Resonand — roadmap

What the archive could become, after the first version does its job.

**This document carries no task identifiers.** It is features, in the words somebody would use to
ask for one. A number is minted when a feature is cut into tasks, by the plan that cuts it. A
roadmap that hands out numbers for work nobody has started is how one identifier ends up meaning
two things, which has happened twice here and cost a repair commit each time.

So: **if it is written here, it has not been scoped.** Anything carrying a number lives in a plan
under [`docs/`](docs/), and there are two kinds:

- **[`docs/next-plan/`](docs/next-plan/)** — what is scoped and waiting. Always this name, so a
  link to it never goes stale and "what is queued" is always one place.
- **`docs/<version>-plan/`** — one per version, holding what that version contained.
  [`docs/v0.1.0-plan/`](docs/v0.1.0-plan/) is the first, and becomes the record of the first version on the
  day it ships.

A feature therefore travels: written here without a number, given one when it is scoped into
`next-plan/`, and coming to rest in the folder of the version that shipped it.

**There are no dates anywhere in this document.** A long roadmap with dates is a promise a
one-person project cannot keep, and breaking it costs more credibility than never having made it.

The sections are in the order these matter in, most first. Inside a section there is no order at
all.

---

## 1 · The transcription boundary

The thing the project is actually about: Resonand does not transcribe, it consumes an engine
somebody else chose. Most of what is already understood here is scoped in
[`docs/next-plan/transcription.md`](docs/next-plan/transcription.md); this is what is wanted and
not yet worked out.

- **More than one transcriber**, perhaps one per language, chosen per recording or per library
  rather than per instance.
- **Segments that break on sentences rather than on clock time.** What comes back is bounded by the
  engine's own windowing, so this is a stitching decision on this side of the boundary: the
  transcript reads as prose while the timing stays fine enough to seek with.
- **The fragment length as configuration**, checked against what a model actually accepts. It runs
  against the grain of what shipped — the engine declares its ceiling and the worker cuts to it —
  so a setting here overrides a declaration, and has to say what happens when the two disagree.
- **What a transcription cost**: how long it took, which model answered, which engine.
- **Recordings marked never to transcribe** — music, ambience, a sound kept for its own sake. It
  also stops the queue spending on things nobody will ever search.
- **Recordings with no speech in them**, which is the same question from the other end: today they
  come back empty and are indistinguishable from a failure. Deciding what an empty transcript
  *means* is the work.
- **Speaker identification**, and only under the design condition in [`VISION.md`](VISION.md): the
  same pattern as transcription, an optional module consuming a service the user configures, never
  integrated into the application. Biometric identification is an Annex III high-risk category
  under the AI Act, and the free-software exemptions do not cover high-risk systems. Distinct from
  *diarisation* under **Not doing** — an engine that already labels speakers has its labels kept.

## 2 · What you do with a transcript

The first version can find a moment. None of this is about finding one; it is about what happens
once you are looking at it.

- **Editing what came back.** A correction creates a new transcript derived from the original,
  which is **always kept** — the archive no more overwrites what a machine produced than it
  overwrites an original recording, and the editor has to make that unmistakable.
- **Parts of a recording attached to ideas**, so a moment can be named and returned to.
- **Those ideas organised** within the transcript rather than left in a flat list.
- **Two readings of one transcript**: continuous prose, and segment by segment. The segments are
  the stored form, so both are views over the same rows rather than two formats.
- **Exporting one recording's transcript from the interface.** The CLI already writes `.vtt` and
  `.srt` beside an export, so what is missing is the gesture and not the format.

## 3 · Living in the interface

The pile with no theme beyond being what using the thing every day asks for. Shallow work, and
probably the highest felt value per hour spent on it.

- **Seeing the categories, not just setting them.** The tree works and assigning one is fine; what
  is missing is any view that shows what the categories *are* — how much sits under each, what is
  filed nowhere, how a library divides up. Categorising is a chore because the only feedback is a
  filter that returns fewer rows.
- **Colours chosen freely for a library**, rather than the seven fixed ones. Worth weighing against
  the reason they were fixed: seven named colours are a vocabulary, and a free picker is a way to
  end up with two libraries nobody can tell apart.
- **Tags with colours of their own.**
- **A library's settings in two blocks** rather than one column.
- **Sending to transcribe from the list**, not only from inside a recording.
- **Emptying the trash in bulk**, which today is one row at a time.
- **Favourites**, kept with a heart.
- **Looping or stopping at the end, as a setting**, stopping by default.
- **A waveform whose shape somebody can choose.**
- **On a phone, the metadata panel closed on arrival**, so that the recording is what is on screen.
- **A profile picture.**
- **Refusing an upload that has no duration**, which is otherwise a file that fails three jobs later
  and gives nobody a reason why.

## 4 · The archive as something other tools use

The point of the project, and what separates it from everything else in the category — and it only
makes sense once the API is stable enough that tools built on it do not break.

- **An MCP server, over HTTP with a token** rather than stdio, because this is a multi-user
  application. Read tools first: search transcripts, read one, list libraries and categories, read
  metadata — **text and metadata, never raw audio**. Write tools behind an explicit scope after
  that. The rule that keeps it honest is structural: every tool is a thin wrapper over an existing
  endpoint, and a tool that needs logic of its own means the API is wrong and the API gets fixed.
- **Semantic search**, alongside the existing full-text search rather than replacing it.
- **Summaries**, with a configurable provider, under the same egress disclosure rule as
  transcription.
- **Automatic classification**: suggested tags and a suggested category, **always a suggestion,
  never applied directly**. Tags already carry the source that makes this possible; the category
  half needs the suggestion storage deferred out of the first migration, which is written up in
  [`docs/v0.1.0-plan/decisions.md`](docs/v0.1.0-plan/decisions.md).

## 5 · What "shared" means

The permission model resolves individual grants today and the interface has never offered one.
This is the half that was deliberately cut.

- **The sharing panel on a recording**, which has to visually distinguish access inherited from the
  library from access granted on this recording: inherited rows read-only and named as inherited,
  individual rows editable. Revoking states the consequence in numbers, and the honest sentence is
  a different one — revoking an individual grant may leave the person with access anyway, through
  the library.
- **"Shared with me"**, the destination a recording shared on its own is reachable from. An
  individual grant deliberately does not grant its library, so such a recording sits in no library,
  no sidebar entry and no route: today it is reachable only by search or by its URL. The endpoint
  that answers it already exists and the interface has never called it.
- **The library a recording is in, named on the recording.** The interface resolves that name
  against the library list, which holds only while every readable recording sits in a readable
  library — and an individual grant breaks that by design. The breadcrumb, the player's label and
  the move dialog all read it.
- **Sharing a transcript without the audio.** A real separation in the permission model rather than
  a flag on a share: a level that reads text but not bytes does not exist today.
- **Suggestions while sharing**, instead of typing a full address. The lookup is deliberately narrow
  — full normalised email, at most one result — precisely because a directory of everybody on the
  instance is what it exists to prevent. So this is a decision about what a manager may see, not a
  widening of the lookup.
- **Telling somebody that something was shared with them.** There is no notification surface at
  all; the instance's event stream is the seam one would arrive on.
- **Public share links.**

## 6 · How people get in

Local accounts, created by hand by an administrator, are the whole of the first version.
Everything else about identity was cut.

- **OIDC**: authorization code with PKCE, mapped to a stable subject. Blocked on a decision about
  what happens when a local account and an OIDC account share an email address — written up in
  [`docs/next-plan/decisions.md`](docs/next-plan/decisions.md), where automatic merging is refused
  because it is a privilege escalation whenever the provider does not verify the address.
- **OIDC on the sign-in screen**, with both paths visible when both are enabled, and without OIDC
  looking like a footnote.
- **Naming administrators in a deployment where no local account is ever created**, which is what
  an OIDC-only instance needs and has no way to express.
- **Proxy header authentication** for Authentik and Authelia, **mandatorily tied to a list of
  trusted proxy addresses** and disabled by default. Without the address restriction this is a
  total authentication bypass, so it ships with a test proving that those headers from an untrusted
  address are rejected.
- **Personal access tokens**, with scopes, a library scope, expiry and revocation — the value shown
  **exactly once** and only its hash stored — and the screen that makes that unmistakable.
- **A registration policy** — open, invite-only or administrator-only — and invitations.

## 7 · Running an instance

What an operator needs that the first version leaves to them. What it takes to *install* one is
scoped in [`docs/next-plan/release.md`](docs/next-plan/release.md); this is the part that is still
only a wish.

- **Deleting a user, with mandatory ownership transfer**: it shows how many libraries and how many
  recordings are moving and to whom before confirming, and resolves the personal library too. Until
  it exists the first version simply refuses to delete an account that holds anything, which is a
  considered position rather than a gap.
- **Administrator tooling for data-subject requests**: everything involving one person exported in
  one action, and a hard delete that bypasses trash retention. The project is not the controller —
  the administrator is — but this is what decides whether a professional can use the tool at all.
- **Per-user or per-library storage quotas.** A family instance will eventually want them, and
  nothing is designed for them yet.

## 8 · Reaching further

More people, more devices. Last not because it matters least, but because each of these is worth
more once the seven above are true.

- **Real PWA quality on mobile**: installability, an offline shell, and behaviour on a flaky
  connection with headphones in. Whether that is enough is what decides the last line here.
- **Shipping actual translations.** The plumbing is in the first version; this is the part where
  Catalan, and then others, genuinely exist.
- **A mobile application with capture.** The only item here that changes the positioning — the
  project is a destination and not a recorder, and it stays that way until the archive is mature
  enough that being a recorder as well is an addition rather than a distraction.
- **Somewhere to try it without installing anything**, reachable from the repository itself. The
  demo instance is already scoped in
  [`docs/next-plan/release.md`](docs/next-plan/release.md); what belongs here is that the link is
  the first thing a reader meets, because "self-hosted audio archive" is a sentence nobody can
  picture and a working screen is not.
- **A guided tour, in every installation, that is itself a recording.** A short piece of audio that
  explains the shape of the archive — libraries, a transcript, searching across everything — and
  arrives in a new instance as an ordinary recording somebody can play, scrub and search. The
  product demonstrating itself with its own primitives rather than with a modal carrying arrows,
  and the only onboarding this particular application can do that another could not. It is also the
  honest test of the first-run experience: if the tour is awkward to listen to in the thing it is
  describing, that is the thing being awkward.

---

## Not doing

Written down so they do not come back in through the side door. **None of them may condition a
schema decision before it has been explicitly discussed.**

Not now, possibly later:

- **Recording from the browser.**
- **Performing speaker diarisation.** The `speaker` field has been reserved since the first
  migration, and an engine that labels speakers has its labels kept — including the rule that a
  transcript assembled from several parts carries none, because labels are per request and
  `SPEAKER_00` in part one is not `SPEAKER_00` in part four. What Resonand does not do is work out
  who is speaking.
- **More than one level of the category tree in the interface.** The database has supported the
  tree from day one.
- **Near-duplicate detection.** Hash matching catches byte-identical files only, and audio
  recovered from messaging apps arrives re-encoded — so the duplicates that most need catching are
  exactly the ones it misses.
- **S3 or S3-compatible storage.**
- **A native mobile application**, as distinct from the PWA and from the capture application in
  section 8. The PWA should be enough, and proving or disproving that is what section 8 is for.

Never, because they would make it a different product:

- **Audio editing.**
- **A podcast player.**
- **A music library manager.**
- **A transcription engine inside the application.** This is the non-goal that defines the project
  rather than limiting it.
