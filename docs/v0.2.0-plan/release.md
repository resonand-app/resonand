# Releasing, in 0.2.0

What `0.2.0` changed about how a release is made, and the release itself — moved here from
[`docs/next-plan/release.md`](../next-plan/release.md) on the day it was released, and kept as it
was written when the work closed. How the repository opened and `0.1.0` was published is in
[`docs/v0.1.0-plan/release.md`](../v0.1.0-plan/release.md).

## How a release is made

Two corrections to the workflow that published `0.1.0`, each found by inspecting what that release
produced rather than by reading the workflow, and neither verifiable until the next tag.

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

## Surviving an upgrade

The uncounted metric for the whole project: whether instances that already hold somebody's archive
survive being updated.

- [x] **OPS-9** · **Cross-version migration matrix**: upgrade a database populated by every
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

      **Done, at the second release, and the published image writes the archive itself.**
      `.github/scripts/upgrade-from-releases.sh` pulls each released image, starts it on an empty
      volume, and fills it the way somebody's instance was filled: `create-admin` and
      `resonand import` for three generated recordings, then the release's own API for a second
      account, a library shared with it at *Can edit*, a category, a tag, a recording moved into the
      shared library and one sent to the trash. A title of 260 characters and a library name of 135
      go in too, because nothing before `0.2.0` refused them and `0006` has to shorten both. The
      container goes, the volume stays, and the candidate is started over it.

      What it asks afterwards is whether an operator would notice anything: `resonand fsck` clean
      with all three originals re-hashed, both passwords still signing in, the title and the name
      shortened under their limits and still prefixes of what was typed, search finding the
      recording by its shortened title — `0006` reindexes it, and a stale index is a recording
      nobody can find — the tag and category still on it, the guest still reading the shared library
      and the recording moved into it, and the trash still holding what was in it.

      **The rows are the repository's `v*` tags**, read with `git ls-remote` so a shallow checkout
      sees them. A pre-release is skipped, and so is a tag on the commit being built: on release day
      that image is the candidate, not something anybody has pulled. No row at all fails, because a
      green check over an upgrade nobody ran is the fault this exists to remove. A matrix file listing
      the versions by hand was the alternative, and it is one more thing release day has to remember.

      It runs in two places, as `smoke-image.sh` does: `ci.yml`'s `Image` job, so a migration that
      breaks an old archive fails its pull request rather than the tag, and `release.yml`'s build
      job before anything is pushed — on both architectures, which makes it the first upgrade ever
      exercised on arm64. **The cost** is a pull of every released image on each run, 669 MB for
      `0.1.0` and growing by one image a release; when that starts to matter, the rows can be
      thinned to the last release of each minor.

      The writes go through each release's own API, so **a release that changes one of those calls
      keeps the old call for the releases before it.** The script says so where the calls are.

      *Verified* against `0.1.0` from the registry and a candidate built from `main`: `0004` to
      `0006`, one title and one name shortened, every assertion passing, nothing left behind. Run
      with `0.1.0` itself as the candidate, it fails on the unshortened title, which is the
      assertion biting rather than merely passing. **Not verified:** the arm64 half, which runs for
      the first time on the next tag.

## The second release

- [x] **REL-9** · **`0.2.0`, prepared so that the tag is the one thing left.** Everything merged
      since `v0.1.0` — favourites, a trash that can be emptied in one go, limits on how long a name
      can be, and who may take a recording out of a library — ships together, and it ships as a
      minor rather than a patch: `CHANGELOG.md`'s contract says a patch never changes an endpoint, a
      setting or anything on disk, and this changes all three except the setting. ⇢ OPS-9

      **What the tag needs, all of it in one commit, as `REL-5` did it.** `scripts/release.sh 0.2.0`
      for the six places `INF-12` counted. The status lines that name a release — the README's badge,
      its status block and its `docker pull`, `AGENTS.md`'s, `SECURITY.md`'s, `deploy/README.md`'s,
      and the compose file's pin — found by grepping for `0.1.0` rather than by remembering where it
      was written. `CHANGELOG.md`'s section dated, and opening with **Upgrading from 0.1.0**: a
      backup first, because `0006` shortens titles and names and that backup is the only way back to
      the long ones; and *Can edit* checked on every shared library, because it narrowed.

      **The section was checked against what merged, not against what was written down.** A read of
      every merge since the tag found five things nobody had entered: the bulk toasts (`UI-46`), the
      toast after a single trash or move (`UI-47`), the keyboard-walkable account menu (`INF-24a`),
      `favourite=true` on a library's listing and on search (`API-27`), and the published image's
      commit labels (`OPS-12b`).

      **The plans handed over.** What `0.2.0` shipped moved from `docs/next-plan/` to this folder,
      one file per track, each entry as it was written. A track with nothing left queued keeps its
      file in `docs/next-plan/` with its rules and a line saying so, rather than being deleted: the
      next task in it would otherwise have to rewrite the rules the last one had already written.
      The entries `0.1.0` itself shipped — Gate 1 and Gate 2 of `release.md` — had never moved at
      all, so they went to [`docs/v0.1.0-plan/release.md`](../v0.1.0-plan/release.md): the record
      of what that version took, completed rather than added to.

      `UI-46` and `UI-47` were merged without their boxes ticked, and neither fully meets its
      criterion, so they are ticked here with the gap named in each rather than in silence, and the
      gap is scoped as `UI-46a` and `UI-47a`.

      One sentence was wrong and is corrected rather than carried forward: `deploy/README.md` said
      CI restores a backup on each architecture, and the release workflow only ever ran the smoke
      test there. It now says what runs on each architecture, which since `OPS-9` is true.

      *Done when:* the tag is pushed, `ghcr.io/resonand-app/resonand:0.2.0` pulls for both
      architectures from a machine with no credentials, `docker inspect` names the tagged commit,
      the release page carries this version's section alone, and no file still says `0.1.0` is the
      latest release.

      **Not done here, and deliberately:** the tag itself, for `REL-5`'s reason — it publishes
      something that cannot be unpublished. Three things are only verified by it: `OPS-8a`'s notes,
      `OPS-12b`'s labels and `OPS-9`'s upgrade on arm64, none of which has ever run.
