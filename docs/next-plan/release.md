# Opening the repository, and shipping a release

`REL-*`, plus the infrastructure and operations tasks that belong to the same two moments. Nothing
here is part of the first version: the first version is a working archive, and this is what it
takes for somebody who is not its author to read it, install it and keep it running.

## Gate 1 · The day the repository opens

Every task in [`docs/v0-plan/`](../v0-plan/) closed, and then these three, which are what have to
be true the moment somebody outside can see any of it.

- [ ] **INF-10** · `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates, and
      `SECURITY.md` with a contact address. Deliberately not done earlier: community scaffolding
      before there is anything to contribute to is furniture in an empty room. It stops being
      furniture the moment the repository opens, because from that moment somebody can file an
      issue and there is nothing telling them how.
      *`SECURITY.md` already ships and routes every report through GitHub's private vulnerability
      reporting, which does not exist on a private repository — so the file is correct and inert
      until this gate, and the contact address is the half that stays owed.*

- [ ] **REL-6** · **The README stops describing a project being built and starts describing the
      first version**, and [`ROADMAP.md`](../../ROADMAP.md) is brought level with it: anything still
      open in [`docs/v0-plan/`](../v0-plan/) on that day either ships or moves, so that a reader
      arriving the day it opens finds one account of what exists rather than three. The status
      block is what has drifted furthest — it still says the interface is being built, which
      stopped being true before the cross-cutting pass. ⇢ REL-1

- [ ] **REL-1** · **The README's screenshots**, two of them, light and dark. Interface quality is
      the one claim that cannot be verified from a list, which is exactly why it gets shown rather
      than asserted. It lands in `REL-6`'s pass: a README describing a finished interface and
      showing none of it is the same fault in the other direction.

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

- [ ] **OPS-9** · **Cross-version migration matrix**: upgrade a populated database across every
      released revision, not just the previous one, in CI. ⇢ OPS-8 🧪
      *`OPS-6` in the v0 plan owes the single-hop version of this test — populate, upgrade one
      revision, assert nothing was lost — and writing it as a walk over the revision tree rather
      than as a pair makes it the first instance of this one.*

- [ ] **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
