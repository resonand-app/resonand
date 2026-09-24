# Ingestion, after the first version

`ING-*` — the ways audio gets in that the first version did not build. Everything else in the
track shipped, and is recorded in [`docs/v0.1.0-plan/ingestion.md`](../v0.1.0-plan/ingestion.md).

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
