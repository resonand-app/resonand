# AGENTS.md

Instructions for coding agents working in this repository. Read this before touching anything.

## What Sonarium is

A self-hosted archive for personal audio recordings: it keeps the original byte-for-byte,
transcribes it through a provider you choose, and lets you search inside every transcript you own.
A single container — Python 3.12 + FastAPI + SQLite/FTS5 on the back, React 19 + TypeScript + Vite
on the front, one in-process job worker. Licence AGPL-3.0.

**Status: pre-alpha. Nothing is released, nothing is installable, there is no published image.**
Do not add release notes, version bumps, publish steps or "getting started — install this" copy
unless a task asks for it. `README.md` is the product statement, `VISION.md` the principles,
`ROADMAP.md` what is deliberately *not* in the first version.

## Repository map

How the tree is organised, not what is in it — a file listing rots, the shape does not.

| Path | How it is organised |
|---|---|
| `backend/` | The `sonarium` Python package, a test suite mirroring it, and the whole toolchain description (`pyproject.toml`, `uv.lock`) |
| `frontend/` | The interface (`src/`) beside the vendored design system (`design-system/`), which sits outside `src/` on purpose (`DEC-21`) |
| `docs/` | The committed plans. `docs/internal/` is local-only |
| `deploy/` | What an operator needs: the compose file, `.env.example`, and a README of their own |
| `Dockerfile` | Multi-stage. The bundle and the package come out of one image |
| `.pre-commit-config.yaml`, `.github/workflows/ci.yml` | The quality gate, described once and run in both places |

### `backend/sonarium/`

Layered, and the dependency runs one way:
`core` ← `db` / `acl` / `media` / `transcription` ← `api` / `jobs` / `cli`.

- `core/` — primitives with no dependencies of their own: settings (pydantic-settings, every
  variable prefixed `SONARIUM_`), ids, time, text, enums.
- `db/` — the engine and its pragmas, the ORM models, Alembic wiring, and one module per
  aggregate. Named repositories, but they are application services: they resolve permissions and
  enforce invariants, not just rows (`REV-S3`).
- `acl/` — one query. Every read and write resolves permissions through it.
- `api/` — composition, dependencies, security, presenters, and `routes/` with one module per
  resource group.
- `media/` — everything that shells out to ffmpeg/ffprobe.
- `transcription/` — the provider boundary: a contract, a registry, and one implementation.
- `jobs/` — the in-process queue and its worker.
- `cli/` — the Typer app `pyproject.toml` installs as `sonarium`.
- `migrations/` — the Alembic tree, shipped inside the package so a container migrates itself.
- `archive.py` — export and re-import, and the only module at the package root: it reaches across
  `db` and `media` and answers to the CLI alone, so it belongs to no one layer. Its test mirrors
  it at `tests/test_archive.py`.

`backend/tests/` mirrors this layout, one directory per package.

### `frontend/`

- `design-system/` — the signed-off visual language (`DEC-8`). `tokens/*.css` is the source of
  truth for every value; `components/` is grouped by family, each shipping a `.prompt.md` saying
  when *not* to use it; `index.ts` is the only public entrance; `guidelines/` are standalone
  specimen cards a designer can open with no bundler in the way.
- `src/api/` — the hand-written client. `contract/` beside it holds the committed OpenAPI
  document and the types generated from it; nothing in there is edited by hand, which is why
  ESLint, Prettier and coverage each exclude it with one glob.
- `src/app/` — the spine: routing, session, keyboard commands, URL state. `shell/` is the chrome
  those modules are wired into, reached from nowhere else; `hooks/` the ones any feature may use.
- `src/features/` — one folder per view, holding its data-bound components and view logic. A
  folder directly under `features/` is a route and owns a `*View.tsx`; a folder nested inside one
  is a part of that view rather than a destination — `settings/administration/` is a tab.
- `src/components/` — composites used by more than one feature, plus the pair that is tested as
  one: `FilterBar` and the `BulkBar` that replaces it have to be the same height.
- `src/player/` — the player, which outlives every navigation and so lives in the shell.
- `src/i18n/` — i18next setup, `en/*.json`, and the hooks that hand a component its copy. Every
  user-visible string is here.
- `src/test/` — the tests whose subject is the repository itself, the msw handlers in `api/`, and
  in `support/` the modules that exist only to be imported by a test.
- **Tests under `src/` live in a `tests/` folder inside the folder they cover**, so a listing
  shows the thing and not the thing plus its tests. They reach their subject with `../`, which
  ESLint allows there and nowhere else: the folder is always a direct child of its subject's, so
  the two move together. `design-system/` keeps its tests flat -- a component there is
  `Component.tsx`, `Component.prompt.md` and `Component.test.tsx`, and splitting the set would
  leave the prompt behind.
- `src/dev/` — `#/specimens`. Development only.

### The plans, and the ones that are not here

A plan is **one file per work track**, indexed by its own `README.md`, so the prefix of an
identifier is the file it is in and there is no exception to remember. There are two kinds, and
they have the same shape:

- **`docs/<version>-plan/`** — one per version, holding what that version contained.
  `docs/v0-plan/` is the first: the first version's working set now, its record once it ships.
- **`docs/next-plan/`** — what is scoped and waiting for a version to claim it. Always this name,
  whichever version is being built.

`ROADMAP.md` is everything further out and **carries no identifiers at all**: it holds features,
and a number is minted by the plan that cuts one of them into tasks.

**`docs/internal/` is absent from a fresh clone.** It holds the authoritative functional and
UI/UX specifications, kept local while the first version is built. A task needing real fields,
states or copy has its answer there and nowhere else: when it is missing, **say so and stop**
rather than guessing them from the design system.

## Toolchain

Backend is `uv` (never bare `pip`/`venv`), Python ≥3.12. Frontend is `npm ci` (never `npm install`
in CI or a fresh clone), Node ≥22.12.

```bash
uvx pre-commit install          # once per clone; installs pre-commit AND commit-msg hooks

cd backend
uv sync --all-groups
uv run ruff check . && uv run ruff format .
uv run mypy                     # strict; no file arguments -- it needs the whole package
uv run pytest -q                # add -m "not slow" for the fast loop
uv run sonarium --help
uv run uvicorn sonarium.api.app:create_app --factory --reload   # :8000

cd frontend
npm ci
npm run lint && npm run format:check
npm run typecheck               # tsc --build --force
npm run test:unit               # vitest; test:coverage in CI
npm run dev                      # :5173, proxies /api to 127.0.0.1:8000
```

## The quality gate

Pre-commit and CI run the **same** checks so a commit that passes locally passes there. Never
`--no-verify`. Never claim a task is done without running them.

They run at two moments. Everything that reads the code runs **on commit**; the two suites that
run it run **on push**, because a correction to an open pull request amends its one commit and
every amend was paying for them again. A push is still gated, and still before anyone else can
see the branch.

- Backend, on commit: `ruff check` → `ruff format --check` → `mypy` (strict) → `sonarium openapi --check`
- Frontend, on commit: `eslint` → `prettier --check` → `tsc`
- On push: `pytest` and `vitest` (CI adds coverage and `vite build`)
- Pre-commit also refuses to commit `docs/internal/`, any file over 512 kB, and private keys

`uvx pre-commit install` installs all three hook types. A clone that installed only `pre-commit`
before this split runs the suites nowhere locally until it is run again.

CI additionally builds the image and asserts it migrates itself, reports healthy, serves the
application shell and the hashed bundle the shell references, and that the CLI runs inside it.

## Conventions

> **The four subsections that follow are scoped to the build of the first version.** Commits,
> pull requests, branches and task identifiers describe how v0 is being built against
> `docs/v0-plan/`. When v0 ships, delete what the identifiers hold together — keeping
> Conventional Commits, the four things a pull request answers, and the comment rules below.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), **in this repository's
voice**:

- `type: subject` — lowercase, no scope, imperative, no trailing period, 72 characters at most.
- Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`.
- The subject names what is now true for somebody using the archive, rather than the mechanism
  that made it true: `let the card grid reach past its first page`, not `accumulate the pages
  under one cache key`.
- The body explains **why**, never restates the diff. Four things, in whatever order the change
  needs and only the ones it has: the problem, in terms somebody would recognise from using the
  thing; the decision the change embodies, where the code cannot say it itself; the alternative
  rejected, and the reason it looks better than it is; the cost somebody will meet later, named
  rather than left to be found.
- Prose wrapped at 80, and prose only — no headings, no bullet lists, no checklists. A commit body
  is read in `git log`. Several short paragraphs beat one long one.
- **ASCII only in commit messages and in code comments.** `--` for a dash, never `—`. Markdown
  prose under `docs/`, `README.md` and `ROADMAP.md` does use real em dashes.
- Last line: the task identifiers, bare and space-separated — `UI-10a UI-10b UI-10c`. No
  `Refs:`, no `Fixes:`, no issue links.
- **Never** add a `Co-Authored-By:` trailer.

### Pull requests

One task is one pull request, and its title is the commit's with the identifiers in front:

```
[UI-6b2] fix: stop the grid's poll growing with the grid
[UI-6b1][UI-6b3] fix: the two defects UI-6b left in the grid footer
docs: decompose individual-recording sharing on the roadmap
```

One `[ID]` per task, no space between brackets, in the order they were done. A change with no
identifier — a chore, a dependency bump, a README fix — carries none and starts at the type. The
rest is the commit subject, unchanged: if a reader has to hold two different sentences for one
change, one of them is wrong.

The description is prose, and may use headings, tables and em dashes; `git log` never reads it.
Four things have to be answerable in it, and a change that cannot answer the first is not a task:

1. **The problem** — what somebody hits today, in their own terms, and with the number if there
   is one.
2. **What changed, and why this way** — the decision, not the file list. GitHub already has the
   file list.
3. **What was rejected** — the alternative that looks better than it is. Where nothing was, say so
   in a clause rather than inventing one.
4. **How it was verified** — the checks that ran, and whatever was exercised beyond them: a
   browser, a real archive, a measurement. **And what was not verified, in one line.** "Not
   verified in a browser: the change is a mount condition and two attributes" is worth more than
   silence, which leaves a reader to assume either everything or nothing.

Then the identifiers on the last line, as in the commit. Headings only where the description is
long enough that somebody would otherwise scroll past something; three paragraphs need none.

### One task, one branch, one commit, one pull request

A task is one branch, one commit, one session. If it cannot be finished in a sitting it was cut
too big: split it, keeping the parent letter and adding a number (`UI-12b1`, `UI-12b2`).

Branch names are the identifier lowercased plus a slug — `ui-12b-follow-and-release`,
`rev-1-write-lock-scope` — or, for a batch, the phase: `phase-e1-e2-libraries-and-library`.
Branch from `main`; merge back through a pull request, with a merge commit.

**A correction to an open pull request amends that one commit** rather than adding to it —
`git commit --amend`, then `git push --force-with-lease` — and the body is rewritten to describe
the branch as it now stands. No commit message says "also", "additionally" or "as reviewed": a
message describes the change that is there, not the order it was arrived at, which is the rule the
comments section applies to code. The description is brought back into line in the same step, and
where somebody has already reviewed, what changed since they looked goes in a comment — that is
where a chronology belongs, and the one place it earns its keep, because their line references
have just moved under them.

A correction that turns out to be a **different concern** is not a correction. It takes an
identifier of its own, as a child of the task that produced it (`UI-6b` → `UI-6b1`), with its own
branch and its own pull request, and says in one line which pull request it came out of.

### Task identifiers

Every task has a **stable identifier that is never renumbered**. The prefix is the work track,
not the phase. Cite them in commits, branches and reviews.

**A number is minted when work is scoped, and by the plan that scopes it.** `ROADMAP.md` hands out
none: a feature there gets an identifier on the day it is cut into tasks, in the file that holds
them. A roadmap that numbers unstarted work is how one identifier comes to mean two things, which
happened to `UI-31` and then to `UI-36`.

**The number stays with the work, not with the folder.** A task scoped into `docs/next-plan/` keeps
its identifier when a version claims it and it moves into that version's folder — the number says
what the work is, and the folder says which version did it.

**The prefix is the file.** Everything under `docs/v0-plan/`, one file per track:

| Prefix | Track | Lives in |
|---|---|---|
| `INF` | Repository infrastructure, tooling, CI | `infrastructure.md` |
| `DEC` | Decisions that block code | `decisions.md` |
| `DAT` | Schema, migrations, ACL, access layer | `data.md` |
| `API` | HTTP skeleton, sessions, authentication | `api.md` |
| `ING` | Storage, ffprobe, waveform, streaming, integrity | `ingestion.md` |
| `JOB` | Queue, providers, segments, FTS5 | `jobs.md` |
| `UI` | Every view in the interface | `interface.md` |
| `OPS` | Docker, configuration, backup, observability | `operations.md` |
| `INT` | Views that cross tracks: trash, administration, security | `integration.md` |
| `TRX` | What an engine has to look like for Sonarium to consume it | `transcription.md` |
| `SEC` | What was hardened before the source was readable by anybody | `security.md` |
| `BUG` | Defects found by using the archive rather than by reading it | `defects.md` |
| `REV` | Backend review findings, and what settled each one | `review.md` |

One more is cited from the code and planned in a working document that is **not in this
repository**, so an identifier carrying it resolves to the code that applied it and nowhere else:

| Prefix | Track | Planned in |
|---|---|---|
| `FBK` | Feedback and liveness: what the interface says while it works | `docs/internal/feedback-plan.md` (local only) |

`REV` has both: `review.md` carries the findings and what settled them, and
`docs/internal/backend-review-v0.md` (local only) keeps the reading that produced them.

Notation in the plans: `⇢ X, Y` depends on those · `🔒` critical path · `🧪` carries a mandatory
test. **A task is done when it meets the criterion written next to it, not when it works.**

Gaps in the numbering are expected: a task that moves to `docs/next-plan/` keeps its identifier,
and one that turns out not to be scoped work at all becomes a feature in `ROADMAP.md` and gives its
number up — which is only safe while nothing cites it.

### Comments

**A comment answers "why?", in one line. Two or three only when one genuinely will not do.**

Write one only where the code cannot say it itself: a non-obvious constraint, a browser or library
behaviour somebody would otherwise "fix", a rejected alternative that looks better than it is. If
the reasoning is already legible in the code, there is no comment to write.

Never restate what the code does, and never narrate the change that introduced it — no bug
reports, no before-and-after, no "it used to". The diff and the commit body hold that; a comment
that tells the story of a fix is read for years by people who never saw the bug.

```ts
// The height is fixed, so a wrapped label is drawn outside the pill.
flex: '0 0 auto',
whiteSpace: 'nowrap',
```

Docstrings are the exception and stay as they are: a module or an exported component earns a
paragraph saying what it is for and what it deliberately is not. Keep it about the thing, not
about its history.

Sentence case, no emoji outside the plans' notation, no marketing register. ASCII only, as in
commit messages.

Entries in `docs/` are prose and not comments: there, name the alternative that was rejected and
state consequences in numbers, at whatever length the decision needs.

## Hard rules

### Never commit

- **`docs/internal/`** — gitignored, and a pre-commit hook refuses it as well, because `git add -f`
  walks past `.gitignore`.
- Audio. Test fixtures are generated with ffmpeg at test time. 512 kB is the hard ceiling.
- Archives (`*.zip`, `*.tar.gz`), `.env`, `*.db`, `storage/`.

### Generated files — regenerate, never hand-edit

| File | Regenerate with |
|---|---|
| `frontend/src/api/openapi.json` | `cd backend && uv run sonarium openapi` |
| `frontend/src/api/schema.ts` | `cd frontend && npm run api:types` |
| `frontend/design-system/tokens.ts` | `cd frontend && npm run tokens` (the CSS is the source of truth) |

They are committed on purpose, so a reviewer sees the API surface change. **Any change to an
endpoint means refreshing the snapshot and the types in the same commit** — CI fails both halves
otherwise (`sonarium openapi --check` on one side, `api-schema.node.test.ts` on the other).

### Backend

- `from __future__ import annotations` at the top of every module.
- **No relative imports** (`ban-relative-imports = "all"`). Import `sonarium.x.y` absolutely.
- mypy `strict`, `warn_unreachable`, and `ignore-without-code` — a bare `# type: ignore` fails.
- No `print()` (`T20`). Log through `structlog`.
- **No naive datetimes** (`DTZ`, and `DEC-11` rests on it): instants are UTC; a recording's own
  time is wall clock plus offset, and the two are never mixed.
- `pathlib`, not `os.path` (`PTH`). Line length 100. Max 8 arguments.
- SQLite is **one serialised writer** with WAL. Do not introduce a second write path or hold a
  write lock across an upload (`REV-1`).
- Never overwrite a whole inherited behaviour where extending it is available.

### API

- Everything is mounted under `/api` (`API-16`, `DEC-24`); `/healthz`, `/readyz` and `/` are not.
  The interface owns every other top-level name.
- `uuid` in URLs, integer ids internal only (`DEC-14`).
- **404, not 403, for a resource the caller cannot read** — a 403 confirms it exists.
- Every route resolves permissions through `acl/query.py`.
  `tests/api/test_no_route_escapes_the_acl.py` enforces it.
- Errors are RFC 9457 problem documents (`api/errors.py`, `src/api/problem.ts`).

### Frontend

- **No colour and no font stack is ever written inside a component.** Every value comes from a
  token. Enforced twice — ESLint while you type and `token-adherence.node.test.ts` in CI — from
  one description in `scripts/token-adherence.mjs`.
- Dark is the default; light is a token redefinition under `[data-theme="light"]`, never a second
  stylesheet.
- **Application code imports from `@/design-system`, never from a file inside it.** Two
  exceptions: `styles.css` from the entry point, and a `?raw` stylesheet from a test.
- The design system never imports from the application, and reaches itself with relative paths.
  The dependency runs one way.
- Reach up with the `@/` alias, never with `../`.
- **Every user-visible string lives in `src/i18n/en/`.** Bare text in JSX fails lint, and so do
  `title`, `placeholder`, `alt`, `aria-label` and `aria-description` literals. Tests are exempt.
- No floating promises, no misused promises, no `console.log` (`warn`/`error` allowed).
- Accessibility is a criterion, not a nicety: `jsx-a11y` recommended, a 44px minimum target, and
  a visible focus treatment. ESLint stays on 9 until `jsx-a11y` supports 10 — do not "fix" it.

## Testing

Evaluate whether a change needs new tests or breaks existing ones. A behaviour the plan names
with 🧪 is not done without one.

**Backend** — `pytest`, mirroring the package layout under `backend/tests/`. Root `conftest.py`
carries only what every area needs (a migrated temporary database on a real file, and its session
factory); area fixtures live in `tests/<area>/conftest.py`. Row factories are in `tests/db/rows.py`.
Two markers: `slow` (excluded from the pre-commit loop) and `ffmpeg` (needs the real binaries;
installed in CI). Settings in tests are always explicit so a stray `SONARIUM_*` in the
environment cannot point a test at a real archive.

**Frontend** — `vitest` + Testing Library + `user-event`, msw for the API (`src/test/api/`). A mock
handler must honour the parameters the real endpoint documents; one that ignores a filter makes
the feature untestable. `*.node.test.ts` files test the shape of the repository rather than a
component — the token union against the CSS, the fonts being shipped, contrast, the committed
OpenAPI document against the generated types.

## Design and UI work

Any interface or asset work goes through the **`sonarium-design`** skill
(`.claude/skills/sonarium-design/SKILL.md`). Read `frontend/design-system/README.md` first, and
the `.prompt.md` beside a component before using it. `npm run dev` then `#/specimens` shows every
component, glyph and guideline card in either theme.

The waveform is drawn from real stored peaks at exactly five sizes. When the peaks job has not
run there is **no waveform** — a dashed rule and a duration, never an invented shape.
