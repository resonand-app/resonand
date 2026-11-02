# Releasing, and what comes after

`REL-*`, plus the infrastructure and operations tasks that belong to a release: what it takes for
somebody who is not the author to read the repository, install it and keep it running. How the
repository opened and `0.1.0` was published is recorded in
[`docs/v0.1.0-plan/release.md`](../v0.1.0-plan/release.md), and what `0.2.0` added to the way a
release is made is in [`docs/v0.2.0-plan/release.md`](../v0.2.0-plan/release.md). The numbering
continues from both.

What is still open: the demo instance, a guide for somebody with an account, and one-click
packaging.

## How a release is made

- [x] **OPS-12b1** · **The image's version label carries no `v`.** Out of `OPS-12b`, and found the
      way that one was: by inspecting what `0.2.0` published rather than by reading the workflow.
      `revision` and `created` came back right, and `org.opencontainers.image.version` read
      `v0.2.0` beside registry tags that all read `0.2.0`. `OPS-12`'s entry and a comment in the
      publish job both said metadata-action would write the semver there, and in the publish job
      it would have — but the labels come from the build job, whose metadata-action was given no
      `tags:` and so fell back to its default `type=ref`, which is the tag's name.

      The label is metadata-action's `version.main`, which is the first enabled tag after sorting
      by priority; `type=semver` outranks `type=ref`, so giving the build job the same
      `type=semver,pattern={{version}}` the publish job has makes it `0.2.0`. Read in the action's
      source at the pinned digest rather than assumed. The publish job's comment now says what is
      true there: its labels are never used, because a join gathers images that already exist.

      Retagging `0.2.0` to correct it was rejected: the cost is a label nobody reads by hand, and
      moving a published tag is the one thing this workflow is built never to do. `0.2.0` keeps its
      `v`, and `resonand version` inside it was always right.
      *Done when:* `docker inspect` on the next release's image reads its version without a `v`.
      **Not verifiable until that tag**, like `OPS-12b` before it.

## After the release

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

- [ ] **OPS-11** · Packaging for one-click installation platforms. ⇢ DEC-6
