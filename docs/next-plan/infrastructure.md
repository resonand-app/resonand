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
