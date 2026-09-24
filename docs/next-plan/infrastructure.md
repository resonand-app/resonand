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
