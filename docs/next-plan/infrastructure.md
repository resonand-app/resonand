# Infrastructure, after the first version

`INF-*` here, rather than in [`docs/v0.1.0-plan/infrastructure.md`](../v0.1.0-plan/infrastructure.md),
which is a record now. The numbering continues from it: an identifier is never reused, whichever
folder it was minted in.

- [x] **INF-13** · **The plan folder is named for the version that shipped it.** `docs/v0-plan/`
      was named for a milestone nobody outside this repository had heard of; it shipped as `0.1.0`,
      and a reader arriving at two folders called `v0-plan` and `next-plan` cannot tell which
      release the first one describes without opening it.

      **A folder is minted per milestone, not per tag.** `0.1.1` will be an entry in
      `CHANGELOG.md` and nothing else. The rename happens on the day a version ships, which is when
      its number is known and is the same moment `docs/next-plan/` hands over what that version
      took — the rule [`next-plan/README.md`](README.md) already carried, with the naming now
      following it.

      The prose inside the folder still says *v0* throughout, and stays that way: that was the
      milestone's name while it was being built, and rewriting the account afterwards is how a
      record stops being one. Its README says so at the top.

      *Done when:* no path in the repository says `v0-plan`, and every link to the folder resolves.

- [x] **INF-14** · **The conventions describe a repository that has shipped.** `AGENTS.md` said the
      four subsections under *Conventions* were scoped to building the first version, and that the
      identifier scheme should be deleted when v0 shipped. It has shipped, so that instruction was
      live — and following it literally would have thrown away the thing that makes a five-year-old
      commit message readable.

      **What changed is one addition rather than a deletion.** Work now arrives from two places: a
      plan this repository holds, and issues on a website. An identifier resolves to a file in the
      clone somebody already has; an issue number resolves to a page they may not be able to reach.
      *Identifiers and issues* writes that asymmetry down and answers the question it decides —
      **issue references belong in the pull request description, never in a commit** — which is the
      rule *Commits* already carried, now with its reason attached rather than as a prohibition
      somebody would eventually relax.

      Three cases cover everything that arrives: planned work with no issue, a report small enough
      to just fix, and a report big enough to scope. Only the third needs both, and the join is one
      line in the plan entry naming the issue — one direction, because a link maintained in two
      places is maintained in neither.

      *Rejected:* dropping identifiers for issue numbers alone, which is what "delete the scheme"
      would have meant in practice. It reads well until somebody runs `git log` on a train, or the
      repository moves again and every `#12` points at a different conversation — which this
      project has already done once.

      [`CONTRIBUTING.md`](../../CONTRIBUTING.md) gains the same thing from the other side: what
      happens to an issue, and why a large one is scoped before it is built.

## What CI and the two suites cost

Measured on 2026-09-24 against `main` at `c7af5b7`, with each suite pinned to four CPUs
(`taskset -c 0-3`) to stand in for GitHub's four-core runner — the backend step measures 150 s
that way and 136–221 s on GitHub, so the two track. The twenty runs before that averaged 545
job-seconds and four and a half minutes of wall time, and every pull request pays twice: once on
its branch and once more on the merge commit. **Seven of the first ten merged pull requests
changed nothing any job reads** — plans, `release.yml`, `.pre-commit-config.yaml` — and paid the
full price both times.

The two suites are most of it. pytest with coverage takes 136–221 s of the backend job, and **half
of pytest is Argon2**: 714 hashes and 274 verifications at 57 ms each, because the API fixtures
make three accounts a test and every sign-in verifies a password. vitest with coverage takes
104–401 s of the frontend job, and **a third of vitest is jsdom**, built afresh for each of 133
files. Removing tests is not where the time is: the two largest candidates are 5% of the frontend
suite between them.

The ten tasks below are that measurement cut into work, in the order it is done. Each is a pull
request of its own, and each branches from the one before it, because four of them edit `ci.yml`
and every one of them ticks a box in this file.

- [x] **INF-15** · **CI runs the hooks a clone may not have installed.** `.pre-commit-config.yaml`
      refuses a file over 512 kB, a private key, a credential `gitleaks` recognises, anything under
      `docs/internal/`, `.claude/` or `local-dev/`, and whitespace, YAML, TOML and JSON faults. CI
      ran none of them while its header said it ran the same checks, so a pull request from a clone
      that never ran `uvx pre-commit install` was held to none of them either — and the repository
      has been public, with a `CONTRIBUTING.md` inviting exactly those pull requests, since
      2026-09-22.

      **A `Hygiene` job runs them over the change, staged the way a commit of it would be.**
      `git reset --soft` onto the commit the change is measured from leaves all of it in the
      index, so each hook reads what it would have read on a laptop. The toolchain hooks are
      skipped by name, because `Backend` and `Frontend` already run the same commands.

      *Rejected:* `pre-commit run --from-ref … --to-ref …`, the documented way to run hooks over a
      range. It hands each hook a list of file names, and the two hooks that matter most read the
      index instead: `gitleaks --staged` would scan nothing and pass, and `check-added-large-files`
      would find nothing added. A check that passes because it read nothing is worse than none.

      *Done when:* the job passes on its own pull request, and its command fails over a change that
      adds a 600 kB file or a file under `docs/internal/`.

      **Done, and a run with nothing to measure from checks nothing.** The first draft staged the
      whole tree on an unborn branch for that case, and the whole tree is not clean: `gitleaks`
      reads the sentence in [`security.md`](../v0.1.0-plan/security.md) reporting the history check
      as a generic API key, and `check-json` cannot parse `tsconfig.app.json` or
      `tsconfig.node.json`, which carry comments. Neither is reached by a change that leaves those
      lines alone, which is every change so far — but both are waiting for the next person who
      edits one, locally as much as in CI. Every change is checked when it arrives, so a run with
      no change has nothing of its own to check, and says so.

- [x] **INF-15a** · **The whole tree passes the hooks, and the weekly run holds it to them.** Out of
      `INF-15`, which found the tree was not clean: `gitleaks` read the sentence in
      [`security.md`](../v0.1.0-plan/security.md) reporting the history check as a generic API
      key — the word before the path is *secrets*, and the path is the "value" — and `check-json`
      refused `tsconfig.app.json` and `tsconfig.node.json`, which carry comments. Each waited for
      the next edit to its file, locally as much as in CI. ⇢ INF-15

      `.gitleaks.toml` passes over exactly that value under exactly that rule, with every default
      rule kept; a key after the word *secret* anywhere else is still caught. `check-json` leaves
      the `tsconfig` files alone, because TypeScript reads them as JSONC and `tsc` already fails
      on one it cannot parse. With the tree clean, a run with nothing to measure from checks all
      of it again, staged on an unborn branch, which is what `INF-15` first built.

      *Done when:* every hook but the toolchain's passes over the whole tree staged as added, and
      the weekly run is what does it.

- [x] **INF-16** · **A workflow is read before it runs.** `release.yml` runs on a tag and on nothing
      else, so a mistake in it is found by the release: `OPS-12a` was found by the first tag, and
      `OPS-12b` by inspecting what it published. Those two were behaviour and no linter would have
      seen them. The class a linter does see — an expression naming an output that does not exist,
      a `needs` on a job that is not there, an input an action does not take — is the class
      `INF-17` is about to write a dozen of, and `actionlint` reads a workflow the way the runner
      will. ⇢ INF-15

      A pre-commit hook, so it runs at commit and in `Hygiene` and nothing else needs to know about
      it. **Its shellcheck and pyflakes integrations are off**: each runs only when its binary is
      on `PATH`, which it is on a GitHub runner and is not on this machine, so the one hook would
      fail in one place and pass in the other — the property `INF-4` exists to prevent.

      *Done when:* `actionlint` passes over both workflows and runs on any change to one.

      **Done.** Both workflows passed as they stood. A probe naming an output of a job that does
      not exist was refused at commit, with the line and the column, which is the mistake a
      filter written in `needs.*.outputs` is most likely to contain.

- [x] **INF-17** · **A change runs the jobs it can reach, and the others report skipped.** A
      `What changed` job reads the change and says which of `Backend`, `Frontend` and `Image` it
      can reach; each of those runs only when it can; and a last job, `CI`, needs all of them and
      passes when each one either passed or was skipped. ⇢ INF-15, INF-16

      **The filters are what each job reads, found by reading the jobs**, not guessed from file
      extensions. `Backend` also reads `frontend/src/api/contract/openapi.json`, which
      `resonand openapi --check` compares against. `Frontend` also reads `backend/pyproject.toml`,
      `backend/uv.lock`, `backend/resonand/__init__.py` and `scripts/`, which
      `one-version-everywhere.node.test.ts` holds to each other. `Image` reads what the Dockerfile
      copies, tests excepted. A change to `ci.yml` or to the filter itself runs everything, and
      renames are read as a deletion and an addition, so a file moved out of `backend/` is a change
      to `backend/`.

      **Everything runs once a week, and on demand**, whatever changed: the backstop for a job that
      starts reading a file its filter does not name, and for the runner image moving underneath —
      ffmpeg comes from Ubuntu's archive, not from anything this repository pins.

      *Rejected:* `paths-ignore` on the whole workflow, which is shorter. A skipped workflow leaves
      a pull request with no checks at all, which reads exactly like one whose checks have not
      started, and a required check on it would wait forever. A skipped job reports as a pass.

      *Rejected:* skipping changes that only touch comments. Comments reach the checks — ruff's
      line length, `# noqa`, `# type: ignore[…]`, `// eslint-disable`, `/* v8 ignore */`, which
      moves the coverage floor — and a FastAPI route's docstring is its OpenAPI description. Only
      the suites could be skipped, knowing needs a parser per language, and after `INF-19` the
      suites cost seconds.

      *Rejected:* filtering Markdown by extension. `frontend/design-system/**/*.md` is outside
      Prettier today, and `.prettierignore` says folders leave that list as they convert: an
      extension filter would go wrong the day one does, and say nothing.

      *Done when:* over a change to `docs/` alone the filter reaches nothing, over one to
      `backend/tests/` alone it reaches `Backend` and nothing else, and with no base to measure
      from — a scheduled or dispatched run — it reaches everything.

      **Done.** Sixteen changes were put through the filter before it was wired in, one per row of
      the arrangement — a test alone, a source file, the snapshot, the lock, the Dockerfile, a
      script, `release.yml`, `deploy/`, the filter itself — and each reached what the entry says.
      Of this plan's own commits, the scoping one and `INF-16`'s reach nothing, and `INF-15`'s,
      which edits `ci.yml`, reaches everything.

- [x] **INF-18** · 🧪 **The suite hashes passwords at test strength.** 714 Argon2 hashes and 274
      verifications at 57 ms each are 58 s of a 119 s backend run: the API fixtures make three
      accounts a test, and every sign-in verifies a password. Production's parameters exist to
      make a guess expensive, and in a test they make nothing expensive but the test.

      A session fixture swaps the hasher for argon2-cffi's `CHEAPEST` profile — the one it ships
      for this — and the hash an unknown address is verified against goes with it. **Production's
      parameters become a named constant** rather than the library's default, pinned by a test, so
      the swap cannot hide a weakening and an upgrade of argon2-cffi cannot move them silently. The
      `SEC-2` tests count verifications rather than timing them, so they are unaffected.

      *Rejected:* a setting for the cost. It would be a production knob that exists for tests, and
      the one knob nobody should be able to turn down. *Rejected:* hashing the password once per
      session, which saves the 714 hashes and keeps the 274 verifications — 16 s.

      *Done when:* a backend run takes half the time it did on the same machine, the test pinning
      production's parameters exists, and every test passes.

      **Done.** 119 s became 52 s on the machine that measured it, and the 716 hashes and 275
      verifications a run now makes take no measurable time between them. Naming the parameters
      changes nothing stored: `RFC_9106_LOW_MEMORY` is exactly what `PasswordHasher()` built, field
      for field, so no existing hash reads as needing a rehash. `test_security.py` pins the numbers,
      and a second test fails if the swap itself is ever lost, which would otherwise show only as
      a suite twice as slow.

- [x] **INF-19** · **The backend suite runs on every core.** After `INF-18` it runs on one — 89 s
      on four CPUs with coverage, at 93% of one CPU. `pytest-xdist` with `-n auto` in CI and in the
      pre-push hook: 45 s on four CPUs with coverage, 22 s without, and `973 passed` three runs out
      of three. ⇢ INF-18

      **The `slow` marker goes.** No test carries it, so `-m "not slow"` in the hook and "the fast
      loop" in `AGENTS.md` both meant the whole suite — and the hook's comment said the ffmpeg
      tests were left out, which they are not. With the whole suite at 22 s there is one loop.

      *Rejected:* `-n auto` in `addopts`. Every single-test run would pay for starting a worker per
      core, and `--pdb` stops working. *Rejected:* `COVERAGE_CORE=sysmon`, the faster tracer: it
      cannot measure branches on Python 3.12, and falls back with a warning.

      *Done when:* CI and the pre-push hook run the suite with `-n auto`, and nothing says
      `not slow`.

      **Done.** On four CPUs the suite takes 43 s with coverage and 23 s without, and on the
      twelve of the machine that measured it, 16 s — `975 passed` three runs out of three. That is
      the pre-push hook's whole cost now, against the 92 s its comment used to quote for a subset
      that was never smaller than the suite.

- [x] **INF-20** · **Backend coverage is a floor, as the frontend's is.** CI runs the backend
      suite with `--cov` and prints 93% into a log nobody reads: `[tool.coverage.report]` has no
      `fail_under`, so the number can fall to anything and CI stays green. It costs 20 s at four
      workers. `fail_under = 90`, below where the code sits for the reason `vitest.config.ts` gives
      for its own floor: a threshold that goes red on the ordinary shape of a commit is one
      everybody learns to lower. ⇢ INF-19

      *Rejected:* dropping `--cov`, which saves the 20 s and keeps nothing.

      *Done when:* CI fails when backend coverage falls below 90%.

      **Done.** pytest-cov reads the floor from `[tool.coverage.report]`, so CI's command did not
      change. Raised to 99 as a probe, the same run failed with *Required test coverage of 99.0% not
      reached. Total coverage: 92.80%* and exit 1; at 90 it passes. The pre-push hook runs without
      coverage, as the frontend's does, so the floor is CI's to hold.

- [x] **INF-21** · **A test's database is a copy, not a migration.** 635 tests migrate a fresh
      database to head, at 12 ms each — 7.5 s of a run `INF-18` brings under a minute — while
      copying a migrated file costs 1.7 ms. One file is migrated per worker and each test gets a
      copy of it; the migration tests keep migrating, because that is what they test. ⇢ INF-19

      *Done when:* outside the migration tests, `upgrade_to_head` runs once per worker.

      **Done.** A serial run migrates 23 times where it migrated 635: once for the file every test
      copies, and 22 times inside the migration tests, which build their own engines. The copy is
      taken after the migrating engine is disposed, because closing the last connection is what
      checkpoints the WAL into the file; copied a moment earlier, what the migration wrote could
      still be sitting in `resonand.db-wal`, which the copy leaves behind.

- [x] **INF-22** · **The repository-shape tests run in Node.** Fifteen `*.node.test.ts` files — 142
      tests, 1.8 s of test time between them — each build a jsdom they never touch, which is 61% of
      what they cost. A `@vitest-environment node` line in each will not do it: the setup file
      stubs `Element.prototype`, and Node has no `Element`. Two vitest projects instead, `dom` with
      the setup file and `node` without it.

      *Done when:* the `*.node.test.ts` files run with `environment: 'node'` and without
      `setup.ts`, and every other test runs as it did.

      **Done.** All fifteen passed in Node at the first attempt — none of them had been leaning on
      the document it was built — and take 3.7 s as a project of their own. The rest of the suite
      is unchanged: 133 files and 1428 tests, the same totals as before the split.

- [x] **INF-23** · 🧪 **A worker's test files share one document, and nothing leaks between them.**
      jsdom is built 133 times a run, a third of what vitest spends. Without isolation it is built
      once per worker: 116 s becomes 40 s on four CPUs, and 137 s becomes 81 s with coverage. **It
      does not pass yet.** Three runs failed 0, 11 and 15 tests, always in files that draw a
      recording — `TechnicalDetails`, `TranscriptVersions`, `Transcript`, `RecordingList` — and
      different ones each time, because what leaks depends on which file ran before in the same
      worker. The setup file resets nothing but the rendered tree. ⇢ INF-22

      The leaks are found and closed before isolation is switched off, and the reset lives in one
      place: a store, a stub or a stored preference one file leaves behind is reset for every file,
      not in whichever test happened to fail.

      *Rejected:* `vmThreads`, which keeps isolation and builds jsdom once per worker — 54 files
      fail on `WritableStream is not defined`, and a run holds 3.4 GB. `threads`: 9% faster, and
      `time.test.ts` fails, because a thread cannot change the time zone of the process it is in.
      happy-dom: already declined in `vitest.config.ts`, for fidelity.

      *Done when:* `isolate: false`, and ten consecutive runs with the file order shuffled pass.

      **Done differently: no document is shared, and nothing is left to leak.** Finding the leaks
      found how many there were. `widen()` in the view harness redefines `innerWidth` and
      `matchMedia` for the phone passes and puts nothing back, so the next file drew a phone; the
      recording view remembers a collapsed panel in `localStorage`; nine files stub the viewport,
      ten stub globals, four spy on `HTMLElement.prototype`, five fake the clock, and the
      harness patches `offsetHeight` on the prototype when it is imported. Every one had been safe
      only because the next file got a new jsdom, and every one would need a reset — and so would
      the next one anybody writes.

      `pool: 'vmForks'` keeps what isolation gave and drops what it cost. The worker loads jsdom
      once, and each file runs in a VM context of its own with a fresh document and module graph:
      jsdom falls from 28% of tracked time to 3%, and at the same load a run with coverage takes
      193 s where it took 271 s, with the same coverage to the hundredth of a point. The one thing
      a context lacks is Node's web streams, which msw builds responses from, and the setup file
      asks the process for them. `vmThreads` would do the same in threads, where `time.test.ts`
      cannot move the time zone. Three runs with the file order shuffled pass, which under this
      pool is a property rather than an achievement.

- [x] **INF-24** · **Each axe audit asks something the others do not.** Every view is audited four
      times — dark, light, the +30% locale and a phone — and two of the four read markup another
      has already read. Light is a token redefinition and jsdom computes no colour, which is
      `contrast.node.test.ts`'s job, so the 22 light audits read the dark theme's markup again
      except where a component draws something different per theme: today the theme row of the
      profile menu and the appearance panel, nothing else. The +30% locale changes the words and
      none of the structure axe reads; its real check, that no string escapes the bundle, stays.
      Together 30 audits and 17 s of the 319 s the frontend's tests take. ⇢ INF-23

      Light is audited where the markup differs, and a guard holds that list to the code: a module
      that reads the resolved theme has to be named by a light audit. The insurance `UI-23a` bought
      is kept, and stops being paid for twenty times over.

      *Done when:* the light audits cover exactly the surfaces whose markup depends on the theme,
      a new theme-dependent module without one fails, and the locale pass asserts no English
      without running axe again.

      **Done, and the light pass had been auditing less than it said.** No audited state had ever
      opened the account menu, so the one module whose markup light changes most was the one the
      twenty-two light audits never saw — and the first audit of it failed, which is `INF-24a`.
      Light is audited on two surfaces now, the account menu and the appearance panel, which are
      the only two modules that call `useTheme()`; a surface names its module as `themed`, and
      `every-view-is-audited.node.test.ts` holds those names to the code in both directions, with
      the design system reading the theme nowhere. The locale pass kept its real check and lost
      its axe half: no component branches on the length of a string — every `.length` test in the
      interface counts a list — so a longer word cannot take a control away. Twenty-nine audits
      go, three guard tests arrive.

- [x] **INF-24a** · 🧪 **The account menu is a menu.** Out of `INF-24`, and found by the audit it
      was about to add: no audited state had ever opened the account menu, and the first audit of
      it failed — `[critical] aria-required-children`, a `role="menu"` holding three plain
      buttons. The role was a promise the keyboard did not keep either: `Menu`, the design
      system's other menu, walks its rows with the arrow keys, and this one did not. ⇢ INF-23

      The rows are `menuitem`s and the rule above them a `separator`, and the arrow keys, Home and
      End walk them through `stepMenuFocus`, which `Menu` now uses too, so the two menus cannot
      drift into walking differently. `V2 - The account menu` joins the audited states, so a menu
      that loses its items again fails there.

      *Done when:* the account menu passes axe in both themes, and its rows answer the keys
      `Menu`'s do.

- [x] **INF-25** · **Every commit on `main` keeps its run.** `ci.yml` says a result on `main` is
      worth having on the record, and set `cancel-in-progress` off there to keep it. On
      2026-09-24 six merges landed in four minutes and three of their runs were cancelled anyway:
      a concurrency group holds one run and one waiting, and a third arriving cancels the one
      waiting, whatever `cancel-in-progress` says. A merge whose run was cancelled is a commit
      nobody checked, and the next green run says nothing about which one broke it.

      `main`'s group is its commit now, so no two merges share one; a pull request's is still its
      ref, so a push to a branch goes on superseding the push before it. Two runs of the same
      commit — its push and a dispatch — still share a group, which is right: it is one result
      being asked for twice.

      *Done when:* the group names the commit on `main` and the ref everywhere else.
