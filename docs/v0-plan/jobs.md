# Jobs, transcription and search

`JOB-*` — the in-process queue, the provider boundary and the FTS5 indexes. Everything slow
lives here, because none of it may happen inside the request that uploaded the file.

## Track B · Job queue, transcription and search

- [x] **JOB-1** 🔒 · In-process job worker: states `pending/running/done/failed/cancelled`, retries
      with exponential backoff, `idempotency_key`, and recovery of jobs left `running` across a
      restart. ⇢ API-1, DAT-2 🧪

- [ ] **JOB-2** · Transcription provider interface (**asynchronous** contract, never a synchronous
      call) and a provider registry driven by configuration. Carries **per-instance credentials and
      usage metering** — audio-seconds submitted, per user, per provider — from the first
      implementation, and a **language parameter** that is optional per request, falls back to an
      instance default and means auto-detect when `null`. ⇢ JOB-1
      *The provider interface is a future revenue surface, not an architecture detail. It does not
      get simplified to save work, and a credit-based service without metering is a rewrite.*
      *Outstanding: only the metering rows. The interface exists and `build_provider` is called
      without a sink, so nothing in a running instance is metered — which `REV-5` settled as the
      decision rather than the omission. The table lands with the first thing that reads it.*

- [ ] **JOB-3** · OpenAI-compatible `/v1/audio/transcriptions` provider, verified against a local
      `faster-whisper` server as the reference deployment and against a hosted endpoint as the
      alternative. ⇢ JOB-2, JOB-13 🧪
      *Outstanding: only the verification. The provider is built and tested, but every test runs
      against a mocked transport and nothing here records a run against either deployment.
      `sonarium check-transcription` (`TRX-1`) is the verb that would produce that record.*

- [x] **JOB-6** · Transcript model: **always segments** with `start_ms`/`end_ms` and a `speaker`
      field present even if diarisation is not implemented. Plain text, subtitles and synchronised
      highlighting are derived from the segments; never the other way round. ⇢ JOB-2, DAT-4 🧪

- [x] **JOB-7** · Several transcripts per audio: re-transcribing creates a new row, only one has
      `is_active = 1`, and switching the active one is atomic. ⇢ JOB-6 🧪

- [x] **JOB-9** · FTS5 indexes: synchronisation of `segment` → `segment_fts` and of the
      title/notes/tags projection (triggers or explicit writes, but one of the two and documented),
      plus a `sonarium reindex` command that rebuilds both. ⇢ JOB-6, DAT-1 🧪

- [x] **JOB-10** · Search endpoint with the ACL applied inside the query, `snippet()` for the
      highlighted fragment, transcript and metadata matches in **one ranked list**, and results
      **grouped under the recording** with three matches shown and a "+N more".
      ⇢ JOB-9, DAT-3 🧪
      🧪 Test that a user does **not** find transcript text they are not allowed to see.

- [x] **JOB-11** · Search filters: library, category, date range, duration range, tags, and
      transcription state — **all four states, repeatable**, not only *has a transcript* / *has
      none*. `UI-16` offers the same four toggles as `UI-8`, so the two have to filter on the same
      set or the vocabulary splits. ⇢ JOB-10

- [x] **JOB-11b** · Widen `/search`'s `transcription_state` to all four states and make it
      repeatable. It accepts `none|done` today, which is why two of V6's four state toggles are
      drawn visibly disabled in the prototype. The four states are derived, not stored: `done` is an
      active transcript, `running` and `failed` are the `transcribe` job's state, and the filter has
      to read them the way `AudioSummary` already does or the badge and the toggle disagree.
      _Done when:_ the same four toggles work in a library and in search. 🧪 repeated parameters
      are a union, not the last one wins; and the filter's answer equals the badge's, state by
      state, over a fixture holding all four.

- [x] **JOB-13** 🔒 · **Chunking long audio, and re-stitching the timestamps.** The
      OpenAI-compatible endpoint caps requests at 25 MB, and compatible local servers impose their
      own memory and timeout ceilings; the anchor use case is a forty-minute interview and the
      daily one is an hour of driving. Split on silence with an overlap, submit the parts, and
      **offset every returned segment by its part's start**, de-duplicating the overlap.
      ⇢ JOB-2 🧪
      🧪 A synthetic three-hour file must come back as one continuous transcript whose segment
      timestamps still line up with playback at the end of the file, not only at the start.
      *Without this, v0 fails on exactly the recordings that motivated the project.*

- [x] **JOB-14** · **Search recall decision and implementation.** `unicode61 remove_diacritics 2`
      gives accent-insensitivity but no stemming: *factory* will not find *factories*, and in
      Catalan and Spanish the inflected forms are where most queries land. Options: append a prefix
      wildcard to the trailing query token, add a secondary FTS5 `trigram` index for substring
      matching, or accept the limitation and document it. ⇢ JOB-10 🧪
      🧪 A recall fixture of real inflected queries against a real transcript, so the chosen
      behaviour is measured rather than assumed.
      *The whole promise is a three-second search. This is a decision to take, not to discover.*
