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

`backend/tests/` mirrors this layout, one directory per package.

### `frontend/`

- `design-system/` — the signed-off visual language (`DEC-8`). `tokens/*.css` is the source of
  truth for every value; `components/` is grouped by family, each shipping a `.prompt.md` saying
  when *not* to use it; `index.ts` is the only public entrance; `guidelines/` are standalone
  specimen cards a designer can open with no bundler in the way.
- `src/api/` — the typed client, generated from the committed OpenAPI document.
- `src/app/` — the spine: routing, the two shells, session, keyboard commands, URL state.
- `src/features/` — one folder per view, holding its data-bound components and view logic.
- `src/components/` — composites used by more than one feature.
- `src/player/` — the player, which outlives every navigation and so lives in the shell.
- `src/i18n/` — i18next setup and `en/*.json`. Every user-visible string is here.
- `src/test/` — the msw handlers, and the tests whose subject is the repository itself.
- `src/dev/` — `#/specimens`. Development only.

### The plans, and the ones that are not here

`docs/v0-plan.md` is the first version: every decision with its rationale, and every task with
its done-criterion. `docs/ui-plan.md` decomposes its frontend track. `ROADMAP.md` is Milestone 1
and beyond — where a deferred task goes, keeping its identifier.

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

- Backend: `ruff check` → `ruff format --check` → `mypy` (strict) → `pytest` → `sonarium openapi --check`
- Frontend: `eslint` → `prettier --check` → `tsc` → `vitest` (+ `vite build` in CI)
- Pre-commit also refuses to commit `docs/internal/`, any file over 512 kB, and private keys

CI additionally builds the image and asserts it migrates itself, reports healthy, serves the
application shell and the hashed bundle the shell references, and that the CLI runs inside it.

## Conventions

> **The three subsections that follow are scoped to the build of the first version.** Commits,
> branches and task identifiers describe how v0 is being built against `docs/v0-plan.md`. When
> v0 ships, delete them — keeping only Conventional Commits itself and the prose voice below.

### Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), **in this repository's
voice**:

- `type: subject` — lowercase, no scope, imperative, no trailing period.
- Types in use: `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `ci`, `chore`.
- The body explains **why**, never restates the diff: the problem, the alternative rejected and
  the reason. Wrap at 80. Several short paragraphs beat one long one.
- **ASCII only in commit messages and in code comments.** `--` for a dash, never `—`. Markdown
  prose under `docs/`, `README.md` and `ROADMAP.md` does use real em dashes.
- Last line: the task identifiers, bare and space-separated — `UI-10a UI-10b UI-10c`. No
  `Refs:`, no `Fixes:`, no issue links.
- **Never** add a `Co-Authored-By:` trailer.

### One task, one branch, one commit

A task is one branch, one commit, one session. If it cannot be finished in a sitting it was cut
too big: split it, keeping the parent letter and adding a number (`UI-12b1`, `UI-12b2`).

Branch names are the identifier lowercased plus a slug — `ui-12b-follow-and-release`,
`rev-1-write-lock-scope` — or, for a batch, the phase: `phase-e1-e2-libraries-and-library`.
Branch from `main`; merge back through a pull request.

### Task identifiers

Every task has a **stable identifier that is never renumbered**. The prefix is the work track,
not the phase. Cite them in commits, branches and reviews.

| Prefix | Track | Lives in |
|---|---|---|
| `INF` | Repository infrastructure, tooling, CI | `docs/v0-plan.md` |
| `DEC` | Decisions that block code | `docs/v0-plan.md`, `docs/ui-plan.md` |
| `DAT` | Schema, migrations, ACL, access layer | `docs/v0-plan.md` |
| `API` | HTTP skeleton, sessions, authentication | `docs/v0-plan.md` |
| `ING` | Storage, ffprobe, waveform, streaming, integrity | `docs/v0-plan.md` |
| `JOB` | Queue, providers, segments, FTS5 | `docs/v0-plan.md` |
| `UI` | Every view in the interface | `docs/ui-plan.md` (decomposes Track C of `v0-plan`) |
| `OPS` | Docker, configuration, backup, observability | `docs/v0-plan.md` |
| `INT` | Views that cross tracks: trash, administration, security | `docs/v0-plan.md` |
| `REV` | Backend review findings | `docs/internal/backend-review-v0.md` (local only) |

Notation in the plans: `⇢ X, Y` depends on those · `🔒` critical path · `🧪` carries a mandatory
test. **A task is done when it meets the criterion written next to it, not when it works.**

Gaps in the numbering are expected: a task that moves to `ROADMAP.md` keeps its identifier.

### Prose voice

Comments, docstrings and plan entries in this repository explain the reasoning, name the
alternative that was rejected, and state consequences in numbers. Match that when you add to
them. Sentence case, no emoji outside the plans' notation, no marketing register. Do not add
comments that restate the code.

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
