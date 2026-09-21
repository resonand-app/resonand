# The name

`NAM-*` — the rename from `sonarium` to `resonand`, and every place the old string had reached.

[`DEC-7`](decisions.md) claimed `sonarium` once and recorded a cost it accepted knowingly: prior
use of the term in the same semantic field, a sound engineer working under it, and competition for
the word inside the sector this product sits in. [`DEC-26`](decisions.md) is that decision taken
again with a different answer.

**This is the last cheap moment**, which is the whole reason it happens before the repository opens
rather than after. The name is currently on nothing anybody else can reach: no distribution on
PyPI, no package on npm, no image on GHCR, no release, no tag, and a private repository with no
forks and no stars. Each of those becomes somebody else's dependency on the day the repository
opens, and a rename that has to keep the old name working is a different and much larger piece of
work than this one.

**The 1,177 occurrences are not the work.** They are mechanical, and the toolchain names what a
replacement missed before a commit can be written: mypy in strict mode and ruff's
`ban-relative-imports` catch every import line, `sonarium openapi --check` and
`api-schema.node.test.ts` fail if the two generated files were not refreshed in the same commit,
and `git mv` carries the package's blame across intact. The work is the five identifiers that have
already left the repository — an environment prefix an operator has typed into a file, an export
sitting on somebody's disk, a cookie in a browser, a payload on the wire, and a lockup built out of
the letters it is about to lose.

## What the strings become

| | Was | Is |
|---|---|---|
| Distribution, import package, CLI command | `sonarium` | `resonand` |
| Environment prefix, 33 variables | `SONARIUM_` | `RESONAND_` |
| Session cookie | `sonarium_session` | `resonand_session` |
| Database file | `<data_dir>/sonarium.db` | `<data_dir>/resonand.db` |
| Export manifest, and the sidecar beside each recording | `sonarium-archive.json`, `.sonarium.json` | `resonand-archive.json`, `.resonand.json` |
| The header key inside both | `"sonarium"` | `"resonand"` |
| Browser storage | `sonarium-theme`, `sonarium.sidebar-collapsed`, `sonarium.metadata-collapsed` | the same three, renamed |
| `GET /api/instance`, and `/` without a bundle | `{"name": "sonarium"}` | `{"name": "resonand"}` |
| OpenAPI title | `Sonarium` | `Resonand` |
| Image | `ghcr.io/sonarium-app/sonarium` | `ghcr.io/resonand-app/resonand` |
| Compose project, service, volume | `sonarium`, `sonarium`, `sonarium-data` | `resonand`, `resonand`, `resonand-data` |
| Container account | `sonarium`, uid and gid 10001 | `resonand`, **uid and gid 10001** |
| Repository | `sonarium-app/sonarium` | `resonand-app/resonand` |

Two of those rows carry more than a replacement.

**The container's uid and gid do not move.** The account is renamed and the numbers are not,
because the numbers are what every file in an existing volume is owned by and the name is only what
`ps` prints. `OPS-6` already cost an afternoon to the other side of this — a restore whose files
arrived owned by the restorer and a container that exited on "attempt to write a readonly
database" — and changing 10001 here would reproduce that on every instance at once.

**The wordmark is not renameable.** The mark is three radiating arcs curling into the letter `S`,
with `onarium` set after it, so there is no edit that turns the lockup into this name; it is drawn
again. That is `NAM-5`, it is design work rather than a rename, and it is why
[`INF-11`](infrastructure.md) waits for it.

---

- [x] **NAM-1** · **The name, and what it touches — written down before a line changes.** This
      file, [`DEC-26`](decisions.md) superseding `DEC-7`, and the two open entries elsewhere that
      describe a world where the name does not change: [`INF-11`](infrastructure.md), whose whole
      remaining job is to outline a wordmark this rename deletes, and
      [`REL-1`](../next-plan/release.md), whose screenshots were taken of the old brand.

      **The rule it hands to `NAM-3`, because otherwise it gets decided five times.** A passage
      recording what was settled on a day keeps its words and gains a pointer — `DEC-7` claiming
      the name, `INF-6` attaching the first remote — because a plan that edits its own record to
      agree with the present has stopped being one. A passage stating how the thing works *now* is
      brought into line wherever it sits, ticked entry or not: a filename, a variable, an address
      and a command are current facts, and one left behind is simply wrong rather than historical.
      _Done when:_ this track exists, `DEC-26` is written, and no open entry anywhere in
      [`docs/v0-plan/`](.) or [`docs/next-plan/`](../next-plan/) still instructs somebody to build
      against the old name. 🔒

- [x] **NAM-2** · **The name claimed, and the repository moved.** `resonand-app` exists;
      `sonarium-app/sonarium` is renamed and then transferred into it, rather than pushed into a
      fresh repository. The reason is that this repository's own conventions put load-bearing
      documentation in pull request descriptions — the alternative that was rejected, and what was
      *not* verified, neither of which a commit body is allowed to hold — and there are 139 of
      them. A transfer keeps all of them and leaves redirects behind; a first push into an empty
      repository keeps the commits and nothing else, and every `#127` cited across this plan stops
      resolving. The placeholder repository created under the new organisation has already been
      deleted, because a transfer cannot land on a name that is occupied.
      *Also the domain, which `DEC-7` counted as part of claiming a name: `resonand.app`. The
      string in `index.html` moves with `NAM-3` and the image it points at is drawn by `NAM-5`.*
      _Done when:_ `resonand-app/resonand` is this repository with its pull requests attached, the
      local remotes point at it, and `INF-6`'s entry carries a pointer here. ⇢ NAM-1

      **Done.** Renamed, then transferred, and both halves kept everything: 140 pull requests, 133
      merged and 7 closed, with their descriptions and their comment threads. The repository's
      `created_at` is still 2026-09-02, which is the evidence it is the same repository rather than
      a copy — and `sonarium-app/sonarium` redirects, so the two worktrees that were open across
      the move never noticed. Remotes live in the shared git directory, so one `set-url` moved all
      of them at once.

      Three things worth knowing before the next one like it. **The transfer API is asynchronous
      and answers with the repository as it was**, so the call returning the old `full_name` is not
      a failure and a 404 at the new path five seconds later is not one either; poll the old path
      until it answers with the new name. **The rename is reversible and the transfer is not**, so
      renaming first and checking the pull requests survived is a free rehearsal of the risky half.
      And **139 pull request descriptions were archived to `local-dev/state/pr-archive/` first**,
      which was better insurance than a throwaway repository would have been: this token has no
      `delete_repo` scope, so a rehearsal repository could not have been cleaned up afterwards.

      The devkit moved with it — `resonand-app/resonand-devkit`, renamed, transferred, its
      description reset and its remote re-pointed. **The local directory names did not move**, and
      deliberately: `repos/sonarium-devkit` is the target of every worktree's symlinks, and renaming
      a checkout orphans this project's agent memory, so that is the last step of the whole rename
      rather than part of this one.

- [x] **NAM-3** · **The rename, everywhere the string appears.** `backend/sonarium` becomes
      `backend/resonand` under `git mv`, and with it the distribution name, the console script, the
      `env_prefix`, the cookie, the database filename, the archive constants, the instance payload,
      the OpenAPI title, the compose project and volume, the image tag, the OCI labels, the CI job
      bodies, the three browser keys, and every document, under `NAM-1`'s rule about which passages
      are records and which are statements of fact. `openapi.json` and `schema.ts` are regenerated
      **in the same commit**, as any endpoint change is.

      **No fallback is provided for the environment prefix, the cookie or the database filename.**
      An instance reading both `SONARIUM_*` and `RESONAND_*` is a permanent branch in the settings
      to save one `sed` on one file, on the only instance that exists; the same is true of a
      database opened under either name. What the operator gets instead is the `mv` written down.
      _Done when:_ `git grep -i sonarium` returns only the entries this plan keeps as a record, the
      gate is green, and a container built from the tree starts, migrates and serves. ⇢ NAM-1

      **Done.** 243 files, 1,218 lines replaced and 1,218 added -- symmetric, as a rename should
      be. 96 of them moved rather than changed, so blame survived. What is left of the old string
      is six lines, all records: `DEC-7`'s claim, the two places `DEC-26` describes what `DEC-7`
      chose and rejected, `INF-6`'s first push, and one lineage note in the decisions index.

      The links into the package were the part that would have rotted silently: `security.md`
      alone carries four into `backend/sonarium/api/`, and the package move broke every one. The
      sweep caught them because it read documents as well as code.

      The container was built and run rather than assumed: healthy, `/api/instance` answering
      `{"name": "resonand"}`, `resonand.db` in the volume owned by a `resonand` account that kept
      uid 10001, the shell served with `<title>Resonand</title>` and the hashed bundle it names
      returning 673 KB. `/` answers a problem document to a client that does not accept HTML,
      which is by design and not a fault -- worth knowing before somebody curls it and reports it.

- [ ] **NAM-4** · **An export written under the old name still reads.** The one identifier that
      gets a fallback, and deliberately the only one. An export is the single artefact this product
      builds to outlive the instance that wrote it — [`VISION.md`](../../VISION.md) promises
      exactly that, and [`REL-2`](../next-plan/release.md) will document it as a supported way to
      leave — so a reader that refuses the format it was writing last month undercuts the one
      feature whose whole claim is longevity. The import accepts `sonarium-archive.json`,
      `.sonarium.json` and a `"sonarium"` header key; the export writes only the new names.
      `ING-11c1` is the measure of what the alternative costs: an import that could not find a
      manifest said nothing useful about it and cost an hour.
      _Done when:_ an export produced before `NAM-3` imports into an empty instance and comes back
      whole. ⇢ NAM-3 🧪
      🧪 *A fixture in the old format reads; the round trip writes only the new one.*

- [ ] **NAM-5** · **The mark, the lockup and the icons.** Design rather than renaming, and the
      longest of these in calendar time. The mark stops standing in for a letter it no longer has:
      either it is redrawn, or it becomes a mark set beside the whole word. Downstream of whichever
      it is: `favicon.svg` and `favicon.ico`, six raster icons, `og-image.png`, `site.webmanifest`,
      the three `resonand-mark*.svg` assets, `Logo.tsx` with its prompt and its test, the two
      guideline cards that draw the mark, `design-system/README.md`, which explains the `S`
      relationship in prose, and `.claude/skills/resonand-design/`, which explains it again.
      _Done when:_ nothing in the interface or the brand kit draws the old mark, and the specimen
      board renders in both themes. ⇢ NAM-1

---

## What this track decided against

**Rewriting the history so it always said `resonand`.** The commits move as they are: a transfer
carries the same objects, and there is no import step. Rewriting their text would give all 486 new
hashes, break every `#N` and every SHA this plan cites, and make the history claim something that
is not true — in exchange for a reader never meeting the old name, which is worth close to nothing.
This is the same answer `SEC` gave when squashing was considered and rejected, for the same reason:
the commit bodies are half the documentation of this project.

**One thing is still rewritten, and it was already owed.** [`INF-11`](infrastructure.md) takes a
webfont out of the history because the breach is the distribution rather than the checkout. That
rewrite happens once, after `NAM-3`, and it is the only one.

**Pushing into the empty repository that was created for the new name.** It buys a first push with
no force behind it and costs 139 pull request descriptions. That repository was deleted instead, so
that the transfer has somewhere to land.
