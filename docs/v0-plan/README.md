# v0 — the archive I use

The build plan for the **first version**, which has one job: to replace what I currently do with
my own audio. Publishing is not part of this milestone. Everything that comes after it lives in
[`ROADMAP.md`](../../ROADMAP.md).

This page is the index. Every task lives in the file for its track, and this one carries what is
true across all of them: what the first version is for, the order the work was done in, and what
has to hold before it is finished.

### The utility threshold

> I can put audio in, it gets transcribed, and I find one specific moment by searching across
> everything I have.

Anything that does not serve that sentence directly is not v0. Chasing summaries and AI features
in the first version would mean competing on ground that is already lost.

### The rule that governs this milestone

**Do not offer an installable release until it has run against the real archive without
incident.** In this niche credibility comes exclusively from the author using the tool, and the
fastest way to destroy it is to ship something that loses files. The bar is **several weeks of
real personal use with nothing going wrong in them**, and with what went wrong before that fixed
rather than noted — not a date, and not a checklist that can be ticked while the archive in it is
a test fixture.

**The repository being public is a separate thing, and it came first.** It was originally bundled
with the release in `REL-5`, on the reasoning that there is nothing to show anybody yet. That
reasoning stopped holding once there was: the code, the plan and the decisions behind them are
worth reading before there is anything to install, and [`README.md`](../../README.md) is
unambiguous that there is nothing to install. What stays gated is the release — the tag, the
published image, and anything that invites somebody to trust an archive to this.

### What is cut, and what is not

The **data model stays whole** — rebuilding it later is far more expensive than carrying columns
nobody reads yet. Permission resolution stays exactly as specified, because it is cheap and it is
the foundation everything else stands on.

What is cut is surface: v0 ships with **local accounts only**, users created by hand by the
administrator, and **sharing at library level only**. Left out: OIDC, proxy-header authentication,
individual-recording sharing, ownership transfer (users with content simply cannot be deleted),
API tokens, MCP, manual transcript editing and LLM suggestions. Every one of those keeps its task
identifier and is listed in [`ROADMAP.md`](../../ROADMAP.md).

---

## How to read this plan

Every task has a **stable identifier** (`DAT-3`, `UI-7`…) that can be referenced from commits,
branches and issues. The prefix indicates the **work track**, not the phase, and **the prefix is
the file**: `UI-7` is in `interface.md`, `DAT-3` is in `data.md`, with no exceptions to remember.
**Identifiers never get renumbered** — a task deferred to `ROADMAP.md` keeps the number it has
here, which is why gaps in the numbering are expected and are not mistakes.

| Prefix | Track | What it covers | Where |
|---|---|---|---|
| `INF` | Repository infrastructure | Scaffolding, tooling, CI | [`infrastructure.md`](infrastructure.md) |
| `DEC` | Decisions | The points that blocked code, and what settled them | [`decisions.md`](decisions.md) |
| `DAT` | Data and permissions | Schema, migrations, ACL, access layer | [`data.md`](data.md) |
| `API` | API and authentication | HTTP skeleton, sessions | [`api.md`](api.md) |
| `ING` | Ingestion and playback | Storage, ffprobe, waveform, streaming, integrity | [`ingestion.md`](ingestion.md) |
| `JOB` | Jobs, transcription and search | Queue, providers, segments, FTS5 | [`jobs.md`](jobs.md) |
| `UI` | Frontend | Every view, and the system and spine beneath them | [`interface.md`](interface.md) |
| `OPS` | Operations | Docker, configuration, backup, observability | [`operations.md`](operations.md) |
| `INT` | Integration | Views that cross tracks: trash, administration, security | [`integration.md`](integration.md) |
| `TRX` | Transcription compatibility | What an engine has to look like for Sonarium to consume it | [`transcription.md`](transcription.md) |
| `SEC` | Pre-publication hardening | What was fixed before anybody could read the source | [`security.md`](security.md) |
| `BUG` | Defects found in use | Faults found by using the archive rather than by reading it | [`defects.md`](defects.md) |
| `REV` | Backend review | What a read of the finished backend found, and what settled each finding | [`review.md`](review.md) |

Notation:

- `⇢ X, Y` — **depends on**. Cannot start until `X` and `Y` are done.
- `🔒` — **critical path**: until it is done, entire tracks are stalled.
- `🧪` — carries a mandatory test before it can be called done.
- `❓` — depends on a decision that is still open. **Nothing here carries it any more**; every
  decision the first version needs is settled in [`decisions.md`](decisions.md).

A task is done when it meets the criterion written next to it, not when it "works".

The last four tracks were not planned in advance. `TRX`, `SEC`, `BUG` and `REV` are what came
back from building the thing, hardening it and reading it, and they are here for the same reason
the rest is: an identifier in a commit message or a comment has to resolve to something a reader
of this repository can open.

### Identifiers you will meet in the code that are not here

One track is planned in a working document that is **not in this repository**, and its identifiers
are cited from code and commit messages all the same:

| Prefix | Track | Why it is not here |
|---|---|---|
| `FBK` | Feedback and liveness: what the interface says while it works | A working document, kept local while the first version is built |

A comment citing `FBK-3` is pointing at a decision that was taken and is described where it was
applied, in the code itself. Nothing in this plan depends on that document.

[`review.md`](review.md) is the same shape from the other side: the findings and what settled
them are here, and the reading that produced them — severity, assessment, the measurements taken
at the time — is a working document too. A candid reading of your own code stops being candid
once it is a published artefact.

For the same reason the per-view field tables, state tables and copy are **not reproduced here**.
They live in the interface specification, which is a working document kept out of the repository
while the first version is built; this plan names what to build and points at the section that
says what it contains. The one exception is the **design system**, vendored at
[`frontend/design-system/`](../../frontend/design-system/README.md) because the application
consumes it directly. Everything needed to understand *what* a task is and *why* it exists is
here.

---

## Phase map

The tracks above are how the work is filed. The phases are the order it was done in, and the two
line up almost exactly: Phase 0 is `INF`, Phase 1 is `DAT`, Phase 2 is `API`, Phase 4 is `INT`,
and Phase 3 is four tracks running at once.

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
| Phase 1 | Not much else: `DAT` is the bottleneck. In parallel: `UI-1`, `UI-2` (the design system and the waveform, against generated peaks), and `JOB-13`, which needs no schema |
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
2. **`INF-8`** in parallel, transcribing each decision into `docs/adr/`, one file per decision. It
   is transcription, not fresh thinking — the reasoning is already written.
3. **`DAT-1`**, using **What the first migration contains** in [`decisions.md`](decisions.md) as
   its checklist. Nothing else in the project can be written first, and this is the one place
   where getting it wrong is expensive.
4. **`DAT-2` → `DAT-3`.** The ACL entry point, whose test matrix is the most important one in the
   repository.
5. From `API-2` onwards the four tracks open up and order stops mattering much.

Two things worth starting early because they need nothing from the schema: **`UI-1`/`UI-2`** —
adopting the design system and building the waveform, which draws against generated peaks until
`ING-5` produces real ones — and **`JOB-13`** (chunking and timestamp re-stitching), which is the
highest-risk piece in the whole plan and the one most likely to need a second attempt.

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
5. **Several weeks have passed** with all of the above true and nothing going wrong in them.

Only then does the milestone in [`ROADMAP.md`](../../ROADMAP.md) begin.
