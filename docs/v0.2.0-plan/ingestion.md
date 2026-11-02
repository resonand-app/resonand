# Ingestion, in 0.2.0

What `0.2.0` shipped of this track, moved here from
[`docs/next-plan/ingestion.md`](../next-plan/ingestion.md) on the day it was
released, and kept as it was written when the work closed. The numbering runs on from
[`docs/v0.1.0-plan/ingestion.md`](../v0.1.0-plan/ingestion.md) and continues in
`docs/next-plan/`: an identifier is never reused, whichever folder minted it.

## What shipped, corrected

- [x] **ING-13a** · 🧪 **`fsck` leaves work in progress alone.** Out of `ING-13`, and found by a
      dispatched CI run on `main`: the restore check imports a recording and runs `fsck` straight
      away, and on that run the worker had already begun the transcode — so
      `.derived.opus.partial` was on disk, reported as *left behind by something that did not
      finish*, and a clean archive exited non-zero. `fsck` runs against a live instance by design,
      and `deploy/README.md`'s restore ends on it, so an operator met the same false finding
      whenever a job happened to be writing. ⇢ ING-13

      A fragment is work in progress while its recording has a job still pending or running, and a
      leftover once every job for it has finished, failed or been cancelled. Pending counts too:
      after a restart the interrupted attempt is back on the queue, and the retry writes the
      fragment again. The cost, named: a fragment from a process that died is not reported until
      the instance has started once and its job has stopped — which is when it would have been
      rewritten anyway.

      *Rejected:* judging a fragment by its age. A transcode of a three-hour recording writes one
      file for minutes, and any threshold short enough to be useful is long enough to be wrong.
      *Rejected:* waiting in CI for the queue to drain before `fsck`. It would make the check pass
      and leave the operator the false finding the check exists to spare them.

      *Done when:* a fragment beside a recording with a pending or running job is not a finding,
      one beside a recording whose jobs have all stopped still is, and the restore check cannot race
      the worker.

## The archive, leaving and coming back

- [x] **ING-15** · 🧪 **Favourites survive an export and an import.** Nobody types a favourite twice:
      a set somebody spent a year curating, gone after a restore, is a loss even though no audio
      was. The per-recording sidecar gains `favourited_by` beside `shares`, a list of
      `{email, at}`, so the order `UI-44` sorts by survives as well as the mark. Import resolves
      the addresses the way `_grant_all` resolves grantees: an address with no account is skipped
      and named among the missing, never invented. An archive written before this has no key and
      imports exactly as it did. ⇢ DAT-11, ING-11b

      *Rejected:* a top-level list in `resonand-archive.json`. Everything else about a recording
      lives in its own sidecar, so a recording copied on its own carries its favourites with it.

      🧪 `ING-11b`'s round trip carries favourites across, `at` included; an address with no
      account is reported and not marked; an export from before this imports unchanged.

      *Done when:* exporting an archive and importing it into an empty instance with the same
      accounts gives every account back its favourites, in the order they were marked.
