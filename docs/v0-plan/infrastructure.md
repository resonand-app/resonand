# Infrastructure

`INF-*` — the repository, the toolchain and the quality gate, for both halves of the codebase.

## Phase 0 · Repository scaffolding

Short and mechanical, but it conditions everything that comes after. No product code.

- [x] **INF-1** · Monorepo structure.
      ```
      backend/sonarium/{api,core,db,acl,media,jobs,transcription,migrations,cli}/
      backend/tests/
      frontend/src/{api,app,components,features,i18n,player,test}/
      deploy/            docs/
      ```
      *Done when:* `backend/` and `frontend/` install and start up empty, each with its own "hello".
      *As built the shape differs in three places, and each is a decision taken since: `mcp/` is
      `ROADMAP.md`'s and no directory was created for it; `lib/` never earned one, so what the
      views share is `api/`, `player/` and `test/`; and `scripts/` holds nothing, because the two
      scripts this would have carried are `npm run` entries instead.*

- [x] **INF-2** · Python tooling: `uv` for dependencies and environment, `ruff` (lint + format),
      `mypy` in strict mode, `pytest` + `pytest-cov`. ⇢ INF-1

- [x] **INF-3** · Frontend tooling: Vite + React + strict TS, ESLint, Prettier, Vitest,
      Testing Library. ⇢ INF-1

- [x] **INF-4** · `pre-commit` with both toolchains, failing identically locally and in CI. ⇢ INF-2, INF-3

- [x] **INF-5** · CI on GitHub Actions: lint + typecheck + tests on both sides, plus a build of the
      Docker image. ⇢ INF-4

- [x] **INF-6** · **Push to the remote.** `sonarium-app/sonarium` exists and the local remote is
      attached to it through the `github.com-personal` SSH alias (key `id_rsa_personal`), never
      plain `github.com`. It was empty and private when this was written; it has carried the
      history since, and whether it is still private is `REL-5`'s question rather than this one's.
      ```fish
      git push -u origin main
      ```
      *Done when:* `main` is on the remote and `gh repo view sonarium-app/sonarium` no longer
      reports the repository as empty.

- **INF-8** · `docs/adr/` with the decisions already made, one per file, with the discarded
      alternatives and the rationale. **Decided against, and carrying no box for that reason.**
      `REV-10` asked the same question last and answered it by building the three track files this
      folder now has — `review.md`, `security.md` and `defects.md` — rather than a second place
      where a decision lives. A page per decision beside a plan that already states each decision
      with its rationale is two sources of truth for one fact, and they disagree eventually. The
      identifier stays here, spent, so that nobody proposes the folder a third time.

- [x] **INF-9** · The three identifier repairs the interface plan is written against. Shipped in
      `dda44b6`, which is what settles the number: `ROADMAP.md` used it for the community
      scaffolding too, and that one is now **`INF-10`**.

---


## Phase B · The toolchain

Six tasks, none of them interesting, all of them blocking. Three call sites already carry
written-out instructions for turning the frontend on — `Dockerfile`, `.github/workflows/ci.yml` and
`.pre-commit-config.yaml` each explain what they are waiting for and why they are not failing
today. Follow them.

- [x] **INF-3a** · Vite 6 + React 19 + TypeScript in strict mode, the `@/` path alias, and
      `dev` / `build` / `preview` scripts. `frontend/src/`'s five directories keep their names.
      _Done when:_ `npm run build` writes a hashed bundle into `frontend/dist/`, which `.gitignore`
      already expects. ⇢ INF-1

- [x] **INF-3b** · ESLint (typescript-eslint, react-hooks, jsx-a11y) and Prettier, configured to
      agree with `.editorconfig` and with the backend's line width.
      _Done when:_ `npm run lint` and `npm run format:check` pass on an empty app. ⇢ INF-3a

- [x] **INF-3c** · Vitest + Testing Library + jsdom, with coverage thresholds and a `test:unit`
      script.
      _Done when:_ one trivial component test runs in CI. ⇢ INF-3a

- [x] **INF-3d** · Wire both into `pre-commit` and CI so they fail identically, which is the
      standard the backend already holds itself to.
      _Done when:_ the hooks the `.pre-commit-config.yaml` comment promises exist, and
      `ci.yml` grows a `frontend` job. ⇢ INF-3b, INF-3c (amends INF-4, INF-5)

- [x] **INF-3e** · Turn on the Dockerfile's frontend stage: uncomment the build stage, uncomment
      the `COPY --from=frontend-build` line, delete the backend-only warning at the top. Three
      edits, all in one file, all already marked.
      _Done when:_ the image serves the built SPA from `/app/static` and `/readyz` still answers.
      ⇢ INF-3a 🧪 the existing image smoke test also loads the shell

- **INF-9** · The three repairs above: `UI-36` in `ROADMAP.md`, `JOB-11b` here, the component
      count in the specification, and `UI-32`–`UI-35` plus `JOB-11b` registered in
      the plan.
      _Done when:_ `UI-31` means one thing, the component count means one number, and no identifier
      exists in one document and not the other. It runs **before** Phase A rather than beside it,
      because Phase A's commits cite these numbers.

---


### Three repairs before anything cites them (INF-9)

- **`UI-31` names two different things.** It is the libraries landing in [`interface.md`](interface.md) and
  shipping actual translations in `ROADMAP.md`. Both documents promise identifiers are never
  renumbered, so one of them is wrong. **`UI-31` stays the libraries landing** — it is the one with
  dependents — and the roadmap's becomes `UI-36`. *It is `UI-40` now: `UI-36` was handed out a
  second time, to the lockup, which shipped under it. The same repair, the same way round, and the
  second occurrence is why the plan is the only document that mints a number.*
- **The component count is stated three ways.** The filesystem holds twenty-one; the design
  system's README enumerates those twenty-one by name without ever stating a number; the
  specification says nineteen, and that `UI-1` will port thirty-two. The filesystem is right:
  **21 shipped + 13 owed = 34**, and `CreateLibraryCard` and `ColorSwatchPicker` are the two that
  arrived after the count was written. **The wrong number exists only in the specification**, which
  is not committed — so this half of the repair lands locally and is invisible to a fresh clone.
- **The four-state search widening had a parent already.** `JOB-11` in [`jobs.md`](jobs.md) promises
  search's transcription state as "all four states, repeatable", and the rest of `JOB-11` is built —
  so the widening is a split of a partly-done task, not a new one. It is **`JOB-11b`**, following
  the `API-7b` precedent, and not `API-10b`: `API-10` is the library grid, and a suffix names its
  parent. Renaming is free only until something cites it, which is now.

`INF-9` makes those three true, in one commit, across `ROADMAP.md`, the plan, this
document and the specification. It also **registers `UI-32`–`UI-35` and `JOB-11b` in
this plan**, which is the numbering authority — an identifier that exists only here is an
identifier the other document will one day hand out twice. Every task below is written against the
repaired numbers.

---
