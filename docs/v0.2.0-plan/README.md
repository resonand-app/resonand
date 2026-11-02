# 0.2.0 — favourites, the trash, and the second release

> **Shipped as `0.2.0`.** What it contained was scoped in [`docs/next-plan/`](../next-plan/) and
> moved here on the day it was released, each entry as it was written when its work closed. What
> is scoped and still waiting stays in `docs/next-plan/`; what is wanted and not yet scoped is
> [`ROADMAP.md`](../../ROADMAP.md).

Unlike the first version, this one had no plan of its own while it was built. It is whatever had
been scoped and finished when the tag was cut, which is the shape every version after the first
takes: work is scoped in `docs/next-plan/`, and the version that ships it is the folder it comes to
rest in. [`CHANGELOG.md`](../../CHANGELOG.md) says what changed for somebody running it; this says
how each change was decided, built and verified.

## What is here

| File | Track | What it covers |
|---|---|---|
| [`decisions.md`](decisions.md) | `DEC` | Who may take a recording out of a library (`DEC-27`), and how a permanent deletion is confirmed (`DEC-28`) |
| [`data.md`](data.md) | `DAT` | Trashing and moving need *Can manage*, a favourite per account, and how long a name can be |
| [`api.md`](api.md) | `API` | Marking a favourite, the listing across libraries, and emptying the trash in one call |
| [`interface.md`](interface.md) | `UI` | The heart, the favourites view, fields that know a name's limit, and toasts that say what happened |
| [`integration.md`](integration.md) | `INT` | Deleting from the trash without typing, and emptying it whole or in part |
| [`ingestion.md`](ingestion.md) | `ING` | `fsck` leaving work in progress alone, and favourites surviving an export |
| [`defects.md`](defects.md) | `BUG` | A transcript that opened blank, and an import onto a recording in the trash |
| [`infrastructure.md`](infrastructure.md) | `INF` | The conventions after the first version, and what CI and the two suites cost |
| [`release.md`](release.md) | `OPS`, `REL` | The release workflow's corrections, the upgrade from every earlier release, and the release itself |

Notation is the plans': `⇢ X, Y` depends on those · `🔒` critical path · `🧪` carries a mandatory
test. **A task is done when it meets the criterion written next to it, not when it works** — and
where one was ticked with a clause unmet, the entry says which, and names the task that owes it.
