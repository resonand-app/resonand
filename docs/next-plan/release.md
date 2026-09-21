# Opening the repository, and shipping a release

`REL-*`, plus the infrastructure and operations tasks that belong to the same two moments. Nothing
here is part of the first version: the first version is a working archive, and this is what it
takes for somebody who is not its author to read it, install it and keep it running.

## Gate 1 · The day the repository opens

Every task in [`docs/v0-plan/`](../v0-plan/) closed, and then these three, which are what have to
be true the moment somebody outside can see any of it.

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
      open in [`docs/v0-plan/`](../v0-plan/) on that day either ships or moves, so that a reader
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

## Gate 2 · The release

Several weeks of real personal use on top of gate 1, with what went wrong fixed rather than noted.
Then:

- [ ] **REL-5** · Semantic versioning, `CHANGELOG.md`, and the `v0.1.0` tag with the published
      image. ⇢ OPS-8

- [ ] **OPS-8** · Publishing the image to GHCR from CI, with `latest` and per-version tags. The
      build already runs on every commit and ends at `push: false`; this is the line that changes
      and the credentials behind it.

- [ ] **REL-2** · **User documentation**: installation, transcription provider configuration,
      backup and restore, and **how to leave the product** — the full export, documented as a
      supported path rather than an escape hatch.

- [ ] **REL-3** · Public API documentation and a token guide. ⇢ REL-2

- [ ] **REL-4** · **Demo instance, linked from the repository itself.** "Self-hosted audio archive"
      is a sentence nobody can picture, and the first thing a reader meets should be a working
      screen rather than a paragraph. Synthetic data only (`DAT-8`), with uploads disabled or wiped
      on a schedule: anything a stranger can upload to is somebody's voice held with no agreement,
      no retention anybody agreed to and nobody accountable for it, which is not worth taking on
      to get a demo. A good recording of the real thing is an acceptable substitute.

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

- [ ] **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
