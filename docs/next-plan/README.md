# What is queued

Work that is **scoped and waiting**: it has a done-criterion, it has dependencies, and something
already points at its identifier — but no version has claimed it yet.

**This folder always has this name**, whichever version is being built, so that "what is queued"
is one place and a link to it never goes stale. What a version actually shipped goes to a folder of
its own.

This is one half of a rule that three documents kept breaking. **A number is minted when work is
scoped, and only then.** [`ROADMAP.md`](../../ROADMAP.md) carries features, in the words somebody
would use to ask for them, and carries no identifiers at all; a feature gets a number on the day it
is cut into tasks, and the plan it lands in is the one that mints it. The alternative — a roadmap
that hands out numbers for work nobody has started — produced two collisions already, `UI-31` and
`UI-36`, each of which cost a repair commit.

So a piece of work sits in exactly one of three states, and its home says which:

| | Holds | Identifiers |
|---|---|---|
| [`ROADMAP.md`](../../ROADMAP.md) | Features nobody has scoped | **None** |
| `docs/next-plan/` (here) | Scoped, no version yet | Yes — code and the plans cite them |
| `docs/<version>-plan/` | What one version contained | Yes, kept for good |

[`docs/v0.1.0-plan/`](../v0.1.0-plan/) is the first of those version folders. It is the first version's
working set today and becomes the record of it the day it ships.

## What is here

| File | Track | What it covers |
|---|---|---|
| [`infrastructure.md`](infrastructure.md) | `INF` | The repository itself, after the first version |
| [`transcription.md`](transcription.md) | `TRX`, `JOB` | The findings from the transcriber-compatibility analysis that v0 declined, and the two provider shapes beyond the synchronous one |
| [`ingestion.md`](ingestion.md) | `ING` | The ways audio gets in that v0 did not build, and corrections to what it did |
| [`release.md`](release.md) | `REL`, `INF`, `OPS` | What it takes to open the repository, and then to ship something installable |
| [`decisions.md`](decisions.md) | `DEC` | Decisions that block work here rather than in v0 |

Notation is the plan's: `⇢ X, Y` depends on those · `🔒` critical path · `🧪` carries a mandatory
test. **A task is done when it meets the criterion written next to it, not when it works.**

## The two gates

Nothing here is dated, and the ordering between the two halves is a rule rather than a schedule:

1. **The repository opens** when every task in [`docs/v0.1.0-plan/`](../v0.1.0-plan/) is closed. `INF-10`,
   `REL-1` and `REL-6` were what had to be true on that day — the moment somebody outside can read
   this, they can also file an issue against it. **It opened on 2026-09-22**, and those three are
   closed.
2. **The release** — the tag, the published image, anything inviting somebody to trust an archive
   to this — waited for the five conditions under [*When is v0 done*](../v0.1.0-plan/README.md), which
   held on 2026-09-23. **`0.1.0` is prepared**: the version, the changelog, the status blocks and a
   `deploy/` that pulls rather than builds. What is left of it is `git tag v0.1.0`, which publishes
   and cannot be undone, so it is a person's command rather than a task's last step.

Everything else here is unordered and undated, which is the honest state of it.

## When a version claims some of this

The folder does not get renamed. What a version takes moves into that version's own folder — the
tasks, their criteria and whatever they turned out to need — and what it does not take stays here
for the one after. A task keeps the identifier it was given when it was scoped, wherever it ends
up: the number says what the work is, and the folder says which version did it.
