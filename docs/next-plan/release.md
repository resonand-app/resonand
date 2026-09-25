# Opening the repository, and shipping a release

`REL-*`, plus the infrastructure and operations tasks that belong to the same two moments. Nothing
here is part of the first version: the first version is a working archive, and this is what it
takes for somebody who is not its author to read it, install it and keep it running.

**Gate 1 closed on 2026-09-22.** The repository is public, so everything under it is a record
rather than a working set. **Gate 2 closed on 2026-09-23**, with `v0.1.0`. What is still open here
comes after the tag: the demo instance, a guide for somebody with an account, the cross-version
upgrade matrix and one-click packaging.

## Gate 1 · The day the repository opened

Every task in [`docs/v0.1.0-plan/`](../v0.1.0-plan/) closed, and then these, which are what had to be true
the moment somebody outside could see any of it.

- [x] **INF-10** · `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates, and
      `SECURITY.md` with a contact address. Deliberately not done earlier: community scaffolding
      before there is anything to contribute to is furniture in an empty room. It stops being
      furniture the moment the repository opens, because from that moment somebody can file an
      issue and there is nothing telling them how.
      *`SECURITY.md` already ships and routes every report through GitHub's private vulnerability
      reporting, which does not exist on a private repository — so the file is correct and inert
      until this gate, and the contact address is the half that stays owed.*

      **Done, and two of the four went differently.** The contact address is **not** owed after
      all: it was declined deliberately, because an address in a public file cannot be rotated, and
      the private reporting thread *is* the channel — `SECURITY.md` already says what to do when a
      report goes unanswered on it. What that file did need was its status block, which still said
      pre-alpha where `REL-6` now says the first version is complete.

      And `CONTRIBUTING.md` is not the narrow rule-book this entry assumed. `REL-6`'s README says
      contribution guidelines arrive with the first installable release, so a page of commit
      conventions would have contradicted it on the day both landed. It says instead what *is*
      welcome now — security reports, disagreement with `VISION.md`'s premises, bugs hit running
      it, and whether a transcription endpoint works — and what waits, with the reason. The rules
      are there for somebody who opens a pull request anyway, because sometimes the fix is smaller
      than the issue describing it.

      The code of conduct is deliberately **not** the Contributor Covenant: that assumes an
      enforcement body, a reporting address and a graduated response, and this project has none of
      the three. One that describes a process nobody will follow is worse than a short one that is
      true, so it names the whole toolbox a repository owner actually has -- edit, delete, lock,
      block -- rather than implying more.

- [x] **REL-6** · **The README stops describing a project being built and starts describing the
      first version**, and [`ROADMAP.md`](../../ROADMAP.md) is brought level with it: anything still
      open in [`docs/v0.1.0-plan/`](../v0.1.0-plan/) on that day either ships or moves, so that a reader
      arriving the day it opens finds one account of what exists rather than three. The status
      block is what has drifted furthest — it still says the interface is being built, which
      stopped being true before the cross-cutting pass. ⇢ REL-1

      **Done.** The status block now says the first version is complete and in private use, and
      that nothing is installable — one account of what exists, where there were three. `VISION.md`
      and `deploy/` moved with it, and `ROADMAP.md` needed nothing: it already described everything
      in it as coming after a first version that exists.

      `INF-10` landed the same day, so the README's *Contributing* section points at
      [`CONTRIBUTING.md`](../../CONTRIBUTING.md) instead of restating it. That is this entry's own
      rule applied in the small: two accounts of what is welcome is exactly the fault it exists to
      remove.

- [x] **REL-1** · **The README's screenshots**, two of them, light and dark. Interface quality is
      the one claim that cannot be verified from a list, which is exactly why it gets shown rather
      than asserted. It lands in `REL-6`'s pass: a README describing a finished interface and
      showing none of it is the same fault in the other direction.
      *Shot after `NAM-5` and not before. The three taken for `#114` show a lockup the rename
      removes, so they stopped being usable the day the name changed; `#114` was closed rather than
      merged for that reason, and its branch is kept locally because the prose is a better starting
      point than a blank page even though none of it survives unedited.*

      **Done, four of them.** The recording view with its transcript following playback, a search
      across the archive, and the `Family` grid in both themes — the light-and-dark pair is the
      grid, because a second recording view in light says nothing the first one did not. The phone
      shot that was there is gone: `ROADMAP.md` still has PWA quality open, and photographing a
      phone while promising to do better on one reads as a claim rather than a screenshot.

      They come from `demo-base-full` through the dev layer's `demo/shots.sh` — a running instance
      holding the whole demo world, with real files, real stored peaks and real transcripts, so the
      waveforms are drawn rather than invented. The transcription endpoint is renamed for the run,
      because the panel prints its host and a published screenshot should not carry somebody's own
      network address.

- [x] **REL-1a** · **The hero shot plays from a third of the way in**, with the transcript
      following it, so the waveform carries the played trace behind its playhead instead of
      reading as a recording nobody has opened. Out of `REL-1`, whose shot sat at three seconds.

      **Done, and the constraint was not where it looked.** The player panel and the transcript
      are one scrolling column, and following playback centres the active line — except that a
      target inside the panel's own height snaps to the top instead, leaving the panel whole
      (`UI-11g`). Past that the panel scrolls away behind its fade and the shot loses the waveform
      it is of: `opacity: 0`, measured, on the first two attempts. So the line being spoken has to
      be the **fourth or earlier** while the playhead is a third of the way in, and no recording
      in the world met both.

      What was wrong was the demo world rather than the shot. `Grandma's childhood school` runs
      thirty-eight minutes and was transcribed for fifty-six seconds of them — a shape no real
      archive has, and one that made every screenshot of a long recording a screenshot of its
      first minute. Its transcript now runs the whole length, one line every few minutes, and the
      fourth falls at `12:45` of `38:14`. That spacing is load-bearing and `demo/content.py` says
      so where it is written.

      The cost is a rebuild of `demo-base-full` rather than anything on screen: the hero keeps the
      library, the note, the tag and the category it always had. `library.png` and
      `library-light.png` came back byte-identical across the rebuild, which is the world
      reproducing itself. `search.png` is retaken because the bar at the foot of the shell carries
      the same recording and its trace moved too.

- [x] **REL-1b** · **The README opens with the mark rather than with a screenshot.** A reader met a
      view of a product they could not yet name, and the name arrived underneath it twice — an
      `h1` and a bold tagline each saying what the mark already says. Out of `REL-1`, and recorded
      here after the fact: it shipped in `550cdf0` citing an identifier this plan did not carry,
      which is the one thing an identifier may never do.

      **Done.** The banner carries the name and the description, so the `h1` and the bold line are
      gone and the screenshot moved below the badges, where it answers the second question somebody
      has rather than the first. Compositing the two into one image was the obvious alternative:
      GitHub renders a README image into roughly 880 pixels, so a stacked pair arrives with the
      interface text too small to read — and the screenshots are regenerated from the demo archive
      whenever the interface moves, while the mark does not move at all. Two costs, both named in
      the commit: with images blocked the name survives only in alt text, and the banner is a JPEG
      where everything else here is a PNG, because the gradient and its grain cost 3.5 MB
      losslessly against a 512 kB hook.

## Gate 2 · The release

**The tag waits for the archive, and nothing else here does.** The five conditions under
[*When is v0 done*](../v0.1.0-plan/README.md) are the gate: my real archive in it, a second real person
using it, `ING-13` clean after an upgrade with `OPS-6`'s restore performed for real, the export
round-tripped into an empty instance, and several weeks with all of that true and nothing going
wrong in them. Three of the five are acts and are not tickable anywhere.

**Everything below except `REL-5` can be built while those weeks pass, and should be.** The day the
archive has earned the tag, the tag should be one command rather than a week of infrastructure
written in a hurry by somebody who has already decided to ship. They are in the order their
dependencies allow.

- [x] **REL-7** · **`deploy/` describes an instance somebody can actually start.** Two sentences in
      that directory are wrong on a public repository today.
      [`docker-compose.yml`](../../deploy/docker-compose.yml) names
      `ghcr.io/resonand-app/resonand:latest` and nothing is published, so the first command the file
      documents ends in `manifest unknown`. And [`README.md`](../../deploy/README.md)'s status block
      still says there is no web interface, which stopped being true long before the repository
      opened: `REL-6` brought the body of that file level and left its first paragraph behind.

      **The compose file ships the build it can actually perform.** `build:` becomes the live line
      and `image:` the commented one, and `REL-5` swaps them back — one line each way. The head of
      the file says to copy it into a directory of its own, which stops being true while the build
      context is a clone, so it says that too, for as long as it is true.

      Waiting for `OPS-8` and fixing both at the tag is the alternative. It leaves a public
      repository whose one documented command fails for however many weeks the archive takes, and
      the people who try it in that window are the earliest ones there will ever be.
      *Done when:* a clone, a copied `.env` and `docker compose up -d` reach a healthy container
      with nothing published anywhere, and no sentence in `deploy/` describes a different program.

      **Done, and the premise was half wrong.** `docker compose up -d` in a clone already worked:
      `docker-compose.override.yml` was committed beside
      the compose file and compose loads it without being asked, so the build was always there. What
      failed was everything that assumed a registry — the instruction to copy the two files into a
      directory of their own, which leaves the override behind and so leaves a compose file naming
      an image that does not exist; `docker compose pull` under *Upgrading*; and pinning a previous
      tag under *If an upgrade goes wrong*.

      So this became an account of **where the image comes from**, said in the three places somebody
      meets it — the status block, the compose file's own line and the override's header — each
      naming the release as the day it changes. The override is pointed at rather than folded into
      the compose file: `local-dev/bin/slot/docker.sh` names it on its command line, and that script
      lives in a repository of its own. The cost is that two files swap over on release day instead
      of one, with nothing enforcing it, which is why `REL-5` names both.

      *Verified by running it*: built from these files and started on a development slot's address
      rather than the `127.0.0.1` the compose file publishes, since that address belongs to another
      slot. Healthy, `/readyz` ready, and the shell served with the bundle it references.

- [x] **INF-12** · **One version, in one place, changed by one command.** `0.0.0` is written in five
      tracked places — [`pyproject.toml`](../../backend/pyproject.toml),
      [`__init__.py`](../../backend/resonand/__init__.py), `uv.lock`,
      [`package.json`](../../frontend/package.json), and the `info.version` of the committed OpenAPI
      document — and two of them are checked from the other side. `resonand openapi --check` fails
      on commit when the snapshot is stale, and `UV_FROZEN=1` fails CI when the lock was not
      regenerated. A bump done by hand therefore fails the gate in two places that never mention a
      version, which is the most expensive kind of red there is.

      It is user-visible twice as well: through `GET /instance`, which is where the *About* line
      reads it, and through `resonand version`. A tag that disagrees with the string means every bug
      report cites a build nobody has.

      **`scripts/release.sh <version>`, at the repository root** — the directory `INF-1` created and
      never filled. It belongs to neither package's task runner because it spans both halves.
      Deriving `__version__` from `importlib.metadata` was the alternative: it removes one of the
      five, leaves four, and makes a checkout's version depend on whether it happens to be
      installed.
      *Done when:* `scripts/release.sh 0.1.0` changes all five, relocks, regenerates the snapshot,
      and leaves the gate green. 🧪
      🧪 *A `*.node.test.ts` holding the five to each other. That family already tests the shape of
      the repository rather than a component, and already reads outside `src/`; a pytest doing it
      would put a frontend artefact in the Python suite.*

      **Done, and there are six rather than five.** `package-lock.json` carries the root package's
      version twice — at the top level and again under `packages[""]` — and `npm ci` refuses a lock
      that disagrees with its manifest. So the place this entry did not count is the one that would
      have broken every install rather than merely disagreeing with its neighbours. The script hands
      that pair to `npm version --no-git-tag-version`, which owns both.

      `scripts/release.sh` fills the directory `INF-1` created and never used. It refuses a dirty
      tree, because the point of running it rather than editing six lines is a diff small enough to
      read in one screen; it refuses a leading `v`, because the tag carries one and a `v` that
      reaches `pyproject.toml` builds a wheel nobody can install; and it ends on the two checks the
      bump itself can break — `uv lock --check` and `resonand openapi --check` — leaving the suites
      to whoever ran it. It commits nothing and tags nothing.

      The test is `one-version-everywhere.node.test.ts`, and it asserts the script is present and
      executable as well as reading the six. A release script somebody has to remember to run with
      `bash` is one that gets run some other way on the day it matters.

- [x] **OPS-8** · **The image, published from a tag.** The build ends at `push: false` and the
      workflow declares `permissions: contents: read`, which is the whole of what changes and none
      of the decisions behind it.

      **A second workflow, `.github/workflows/release.yml`, on `v*` tags.** Not a branch inside
      `ci.yml`: that one runs on every pull request, and `packages: write` declared there is a
      credential within reach of every branch that opens one. `docker/metadata-action` mints
      `:0.1.0`, `:0.1` and `:latest`, and the three labels the Dockerfile cannot know for itself —
      `version`, `revision`, `created` — beside the four it already carries. Actions pinned to
      digests as everywhere else in that directory, which dependabot already moves. The package is
      made public and linked to the repository, and the build publishes its provenance attestation.

      Pushing `:latest` from `main` on every commit is the alternative, and it is a rolling release
      nobody asked for: `deploy/docker-compose.yml` documents upgrading as `docker compose pull`, so
      that arrangement moves somebody's archive onto an untagged build the moment they follow it.
      *Done when:* `docker pull ghcr.io/resonand-app/resonand:0.1.0` works from a machine with no
      credentials, and `docker inspect` names the commit it was built from. ⇢ INF-12

      **Done, and the smoke test moved.** `release.yml` builds without pushing, runs the check the
      gate runs, and only then logs in: a registry has no undo, and an image somebody has already
      pulled is in their cache whatever a maintainer does to the tag afterwards. That check used to
      be thirty lines inside `ci.yml`'s `image` job, so publishing would have meant a second copy —
      and the copy that drifts is always the one that runs on release day. It is
      `.github/scripts/smoke-image.sh` now, called from both, and it takes the container down on
      its way out however it ends.

      One guard the entry did not name: **the tag is checked against the manifests** before
      anything is built. `INF-12`'s test holds the six files to each other and nothing holds them to
      the tag, so a mistyped `git tag` would publish an image whose own `resonand version` names a
      different release — and the image is the artefact people keep. It fails with the
      `scripts/release.sh` line that fixes it.

      `latest=auto` rather than a raw `latest`: `v0.1.0` takes it and `v0.1.0-rc.1` does not, so
      somebody who pinned nothing stays on the last release that was finished.

      *Verified as far as it can be without a tag*: `actionlint` clean on both workflows, the
      extracted smoke script run against a locally built image, and the tag-agreement check
      exercised against both a matching and a bumped `pyproject.toml`. **The workflow itself has
      never run and cannot until `REL-5` pushes the first tag.**

- [x] **OPS-12** · **Both architectures, built natively.** The build names no `platforms:`, so what
      exists is amd64, and every arm64 machine gets `exec format error` — a Raspberry Pi, an Apple
      Silicon machine, an ARM VPS, which between them are most of the hardware this kind of software
      is self-hosted on.

      **One job per architecture, each on its own runner** — `ubuntu-24.04` and `ubuntu-24.04-arm`,
      both free for a public repository — each running the smoke test and the restore rehearsal
      `ci.yml` already carries, and then `docker buildx imagetools create` to merge the manifest
      list. `platforms: linux/amd64,linux/arm64` on a single job under QEMU is three lines instead
      of a second job and costs 20 to 40 minutes a run; the real objection is that an emulated build
      cannot run those two checks, so nobody would know whether the arm64 image starts, migrates and
      serves until somebody's Pi did not.
      *Done when:* the manifest list carries both platforms, and each was exercised by the same
      checks on its own architecture. ⇢ OPS-8 🧪

      **Done, and the two halves are pushed by digest rather than by tag.** Each architecture
      builds on its own runner, runs `smoke-image.sh` there, and pushes without a name; a third job
      joins the digests into one manifest list and puts every tag on that. The alternative that
      every guide shows — publishing `:0.1.0-amd64` and `:0.1.0-arm64` and joining those — leaves
      two tags in the registry for good, and a registry is a place where nothing is ever deleted
      quietly.

      `fail-fast: false`, because "arm64 broke" and "both broke" are different mornings and
      cancelling the surviving job hides which one this is. Caches are scoped per platform, since
      one scope would have the two jobs overwriting each other's layers on every release.

      **Three things checked that the entry did not name.** The base images all publish
      `linux/arm64` — `ghcr.io/astral-sh/uv`, `python:3.12-slim-bookworm` and
      `node:22-bookworm-slim` — which was the one way this could have failed on the Dockerfile
      rather than on the workflow. The labels are metadata-action's rather than written by hand:
      its `version` is the semver the tag parses to, where `github.ref_name` would have put `v0.1.0`
      in a label sitting beside tags that all read `0.1.0`. And the manifest is inspected by the
      first tag rather than by a reference rebuilt out of that label, which is the same mistake in
      the place it would have failed the job.

      *Verified*: `actionlint` clean, the `jq` over metadata-action's output run against a sample
      of the shape it emits, and the base images' platforms listed from the registry. **Neither
      architecture has been built by this workflow** — there is no tag yet, and this machine is
      x86_64, so the arm64 half is unexercised until `REL-5`. The cost is named rather than hidden:
      `ci.yml` still builds amd64 only on a commit, so an arm64 break is found at release rather
      than on the pull request that caused it.

- [x] **OPS-12a** · **The digest reaches the join.** Out of `OPS-12`, and found by the first tag
      rather than by reading. Both architectures built, smoke-tested and pushed by digest — and then
      `upload-artifact` refused the one-byte file that carries each digest to the join, because it
      was named for the raw digest and a colon is not a legal filename on NTFS, so the action
      refuses one for everybody rather than only for the people who would have hit it. `Publish` was
      skipped and nothing was pullable.

      The file is named for the digest without its `sha256:` prefix now, and the join puts the
      prefix back. Both halves had to move together, which is why this is one change rather than a
      one-character fix.

      **Nothing had been published when it failed**, which is the only reason the tag could simply
      be moved: the two architectures were in the registry as blobs nothing named, and a blob with
      no tag is not something anybody can pull. Had the join half-succeeded, the repair would have
      been `0.1.1` instead.

      *What it says about the entry above*: `actionlint` and a sample `jq` were as far as local
      verification went, and both passed on a workflow that could not work. Some of a release
      workflow is only ever tested by releasing, and the useful mitigation is that the first tag
      publishes nothing until every step has run — which is what happened.

- [x] **OPS-12b** · **The published image says which commit produced it.** `OPS-8`'s criterion was
      that `docker inspect` names that commit, and `docker inspect` on `0.1.0` named four labels —
      the Dockerfile's static ones — and not `version`, `revision` or `created`. `OPS-12`'s
      restructure is what dropped them: metadata-action moved into the join, and a join gathers
      manifests that already exist rather than building any, so the labels it computed were never
      part of an image. Found by inspecting the published release rather than by reading the
      workflow, which had looked right twice.

      metadata-action runs in the build job as well now, and its labels go to the step that pushes
      by digest. Its tags are ignored there, because what that step pushes has no name.

      The `artifact-metadata: write` permission goes in at the same time. The attestation lands
      without it — the API has one for the index digest — but the job prints two warnings about a
      storage record it could not create, and a warning nobody can act on is one everybody learns
      to scroll past.

      *Verified*: `actionlint`, and the labels' absence measured on the published image rather than
      argued. **Not verifiable until the next tag**, like everything else in this file.

- [x] **OPS-8a** · **The release writes its own notes.** `OPS-8` published an image and stopped, so
      `0.1.0`'s release page was made by hand — and `CHANGELOG.md` links
      `/releases/tag/v0.1.0`, which would have been a 404 if nobody had remembered. A release step
      that lives in somebody's memory is one that is skipped the day they are busy.

      The publish job creates it, **after the attestation and never before the image is pullable**:
      notes describing something nobody can pull are the one ordering of these two that misleads a
      reader. The notes are this version's section of `CHANGELOG.md` and nothing else — the file
      opens with what the number promises and will hold every earlier release underneath, so a
      release carrying all of it says almost nothing about the version it is for. The link
      definition is stripped, since it points at the page the notes are on.

      A version with no section **fails the job** rather than publishing an empty page, and says
      that the image is already pushed so whoever reads it knows what state they are in. A
      pre-release — any version with a `-` in it — is marked as one and does not take *Latest*.

      *Verified by running the step itself*: the `run:` block was lifted out of the workflow with a
      YAML parser and executed against the real `CHANGELOG.md` with `gh` stubbed, which is as close
      as this gets without a tag. It builds
      `gh release create v0.1.0 --title 0.1.0 --notes-file … --latest` with 37 lines of notes
      beginning at the first real sentence; a version with no section and a section holding only
      whitespace both exit 1 with the message above. **Not verified:** the job in CI, which no
      change to this file can be until the next tag.

- [x] **REL-2** · **User documentation**: installation, transcription provider configuration,
      backup and restore, and **how to leave the product** — the full export, documented as a
      supported path rather than an escape hatch.
      *Two things attach to it now. [`CONTRIBUTING.md`](../../CONTRIBUTING.md) says code
      contributions open with the first installable release, so the rules it defers are owed on the
      same day rather than after it. And the export half is written against `resonand export` and
      `resonand import` as `ING-11b` and `ING-11c` left them — a manifest at the root, accounts made
      by hand before an import — because a documented way out that nobody has walked is the most
      expensive sentence this product can print.*

      **Done, and three of the four were already written.** Installation, the transcription
      endpoint, backups and restoring, and the export and its read-back all live in
      [`deploy/README.md`](../../deploy/README.md) and
      [`deploy/transcription.md`](../../deploy/transcription.md), written by the tasks that built
      each of them rather than by a documentation pass afterwards, which is why they describe what
      the code does rather than what somebody remembered about it.

      What was missing was **the first run** — the gap between `docker compose up -d` and having an
      account. One sentence covered it, and it said the first account is created "through the API",
      which is true of the interface and useless to the person reading. The section now says what
      the screen offers while no account exists, what `create-admin` is for when a browser cannot
      reach the instance yet, that the administrator creates everybody else and sets their
      passwords, and that **the instance sends no email** — which is a decision rather than an
      unfilled setting, and which decides how a forgotten password is recovered.

      *Verified against a running instance rather than by reading*: an empty one reports
      `needs_bootstrap: true`, the bootstrap endpoint answers 409 once an account exists,
      `create-admin` creates a second administrator on a populated instance and prints the personal
      library it made, and the three sharing levels are quoted from what `GET /instance` actually
      publishes.

      **Not written, and not what this entry asked for:** how to *use* the archive — libraries, the
      category tree, tags, search, the trash, asking for a transcription. Everything here is
      operator documentation, and every one of the four topics named above is. A guide for the
      person with an account rather than the one with the server is a different document and has no
      identifier yet.

- [x] **REL-3** · Public API documentation and a token guide. ⇢ REL-2
      *The token half is one sentence rather than a guide: API tokens were cut from the first
      version, the API answers to the session cookie, and documenting a credential nobody can mint
      is the fault `REL-6` took out of the README, committed a second time in a second place.*

      **Done as [`API.md`](../../API.md), and it is short on purpose.** The instance already
      publishes its own document at `/api/openapi.json` and serves a browsable copy at `/api/docs`,
      and that document is the field-level truth — a page restating every endpoint beside it is a
      second source that goes stale the first time one of them changes. What it carries instead is
      what the document cannot say: how a script gets a session and holds it, what the conventions
      mean, which endpoints are worth automating, and what the API deliberately will not do.

      The token half is the sentence it was scoped as. A script signs in as an account somebody
      created and keeps a cookie jar; personal access tokens are on [`ROADMAP.md`](../../ROADMAP.md).

      *Verified against a running instance*: `/api/docs` and `/api/openapi.json` both answer,
      sign-in sets `resonand_session` `HttpOnly` `SameSite=lax` with a 30-day `Max-Age`,
      `GET /api/instance` answers without a session, lists carry `{items, limit, offset, total}`, a
      uuid you cannot read answers **404** as `application/problem+json`, no session at all answers
      401, and an `Origin` header from elsewhere gets no `Access-Control-*` back. The problem
      document also carries a `request_id`, which this entry did not know about and which is now
      the thing to quote in a bug report.

- [x] **REL-5** · **The tag.** Semantic versioning, `CHANGELOG.md`, and `v0.1.0` with the published
      image. ⇢ OPS-8, OPS-12, REL-2, REL-7

      **`v0.1.0`, not `v0.0.0`.** `0.0.0` is what the manifests say because nothing has shipped;
      spending it on the first tag leaves nothing underneath it, and a first fix would have to be
      `0.0.1` — a patch of a release that never existed. The contract goes at the head of
      `CHANGELOG.md`, because from that day the number is a promise: **`0.x` may break in a minor,
      a patch only fixes, and `1.0.0` waits until the HTTP API and the on-disk archive format are
      both frozen.** The second of those is the one that matters here, since an archive outlives the
      software that wrote it.

      `CHANGELOG.md` takes the keep-a-changelog shape, and its first entry is **not** a summary of
      525 commits. It is what the first version is — which the README already says once, and should
      not say differently here.

      **Four status blocks move on the same day, and they are the release rather than a chore
      beside it**: the README's, [`SECURITY.md`](../../SECURITY.md)'s *"There is no release, no
      published image and no supported version"*, `deploy/README.md`'s, and `REL-7`'s compose lines
      swapping back to the published image.
      *Done when:* the tag is pushed, the image it produced can be pulled, and no file in the
      repository still says that nothing is released.

      **Prepared, and the tag is the one thing left.** The version is `0.1.0` in all six places
      `INF-12` counted, `CHANGELOG.md` carries the pre-1.0 contract above its first entry, and the
      status blocks moved together — the README's and its badge, `SECURITY.md`'s (the latest release
      is the only supported one, and nothing is backported), and `deploy/README.md`'s.

      **`REL-7`'s two files swapped, and the override went with them.** `deploy/` pulls
      `ghcr.io/resonand-app/resonand:0.1.0` now, and `docker-compose.override.yml` is deleted rather
      than kept: `pull_policy: never` on an instance that could be pulling is an archive pinned to
      whatever was last built on that machine. The dev layer's `slot/docker.sh` named that file on
      its command line and no longer does — its own generated override already carried the build,
      so a slot still runs its worktree rather than a release.

      **The pin is a version and not `latest`.** An upgrade should be a line somebody changed on
      purpose rather than whatever a tag pointed at the morning they ran `pull`; `latest` moves with
      each release for anybody who would rather it did.

      **`CONTRIBUTING.md` opened code and translations**, because it promised both "with the first
      installable release" and a page that says that after the release is a page that lies.

      **Four more places said it and were nearly missed**, each found by grepping the tree for the
      claim rather than by remembering where it was written: `AGENTS.md`'s status paragraph, which
      is the first thing anybody working here reads and which told them not to add publish steps;
      the bug report template, which asked for the commit somebody built "since there is no release
      yet"; and the README's own *Contributing* section, which still said code was closed two
      screens below the table saying it was open. A status block is never in one place, and the way
      to find the others is `git grep` for the sentence rather than memory.

      *The gate this waited for*: the four acts under [*When is v0 done*](../v0.1.0-plan/README.md) were
      confirmed on 2026-09-23 — the real archive in it, a second person using a shared library, the
      restore performed on real hardware, and the export round-tripped into an empty instance.

      **Not done here, and deliberately:** the tag itself. `git tag v0.1.0` is what runs
      `release.yml` for the first time, and it publishes something that cannot be unpublished, so it
      is one command in a person's hands rather than the tail of a session.

      **Tagged on 2026-09-23.** `release.yml` published `ghcr.io/resonand-app/resonand:0.1.0` for
      both architectures and wrote the release notes.

- [ ] **REL-4** · **Demo instance, linked from the repository itself.** "Self-hosted audio archive"
      is a sentence nobody can picture, and the first thing a reader meets should be a working
      screen rather than a paragraph. Synthetic data only (`DAT-8`), with uploads disabled or wiped
      on a schedule: anything a stranger can upload to is somebody's voice held with no agreement,
      no retention anybody agreed to and nobody accountable for it, which is not worth taking on
      to get a demo. A good recording of the real thing is an acceptable substitute.
      *The README's four screenshots are that substitute as it stands, and they are why this is
      below the tag rather than beside it.*

- [ ] **REL-8** · **A guide for the person with an account, rather than the one with the server.**
      Everything written so far is operator documentation: [`deploy/`](../../deploy/README.md) is
      how to run an instance, [`API.md`](../../API.md) is how a script talks to one, and `REL-2`'s
      four topics were installation, the transcription endpoint, backups and the way out. Nobody
      has written how to *use* the archive — what a library is for and when to make a second one,
      how the category tree and tags differ and why both exist, what search can and cannot match,
      what the trash keeps and for how long, what asking for a transcription does and where the
      audio goes, and what each sharing level lets somebody do.

      **Written against the interface as it stands, and short.** The audience is somebody an
      administrator has just made an account for, who has never read a word about this before; the
      test of a sentence is whether it survives being read by that person. Where the interface
      already says a thing well — and it says most of them, in `src/i18n/en/` — the guide points
      rather than restates, because two wordings of one rule disagree eventually and the one in the
      interface is the one people actually meet.

      *Where it goes is part of the task.* A fifth root document is one more thing to keep level
      with the other four; a `docs/guide/` beside the plans crosses what `docs/` has meant until
      now, which is the committed plans. Both are defensible and the entry does not pick.

      *Done when:* somebody who has just been given an account can find one moment in a recording
      they did not upload, and nothing in the guide contradicts what the interface says.
      ⇢ REL-2

## Surviving an upgrade

The uncounted metric for the whole project: whether instances that already hold somebody's archive
survive being updated.

- [ ] **OPS-9** · **Cross-version migration matrix**: upgrade a database populated by every
      released *image*, not one seeded at an old revision by the current code, in CI. ⇢ OPS-8 🧪
      *`OPS-6` settled the half that can be tested from one checkout: a walk over the revision
      tree, populating at each revision and asserting the archive survives the upgrade to head.
      What is left here is the half a checkout cannot reach — a database written by a **published
      image**, upgraded by a later one. The walk seeds each revision by hand from a schema the
      current code describes; only a real old instance proves that what that version actually
      wrote survives, which is the difference that matters once somebody else is running one.*
      *It starts empty on purpose: the matrix compares published images, and the first release is
      one row with nothing to compare against. Its first real assertion is at the second release,
      which is the argument for building it then rather than now.*

- [ ] **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
