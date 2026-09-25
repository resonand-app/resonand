# Ingestion, after the first version

`ING-*` — the ways audio gets in that the first version did not build, and corrections to what it
did. Everything else in the track shipped, and is recorded in
[`docs/v0.1.0-plan/ingestion.md`](../v0.1.0-plan/ingestion.md).

## Audio that arrives without anybody asking

- [ ] **ING-9** · *Watch folder*: watching a directory, automatic ingestion into a configured
      library and category, and moving the file to `processed/` or `failed/`. For voice notes this
      ends up being the main entry path. Transcription on arrival is **opt-in per folder and off
      by default**, with the destination provider named in the folder's configuration, and the
      administration view naming which folders send audio out and where — all four clauses are
      `DEC-9`, which is settled and is what this task has to satisfy rather than revisit.
      ⇢ ING-3, JOB-1
      *Deferred out of the first version rather than cut. Nothing existed behind it — no setting,
      no job kind, no code — and the utility threshold is reached without it, because upload is
      already a way in. What kept it in the v0 plan was not the feature but two documents that
      described it as built, and correcting those was cheaper than building it to match them.*
      *The shape it lands in should come out of real use rather than out of this paragraph. A year
      of putting voice notes in by hand is what says whether the unit of configuration is the
      folder or the file, and whether `failed/` is a directory somebody eventually looks in or a
      row the interface puts in front of them.*

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
