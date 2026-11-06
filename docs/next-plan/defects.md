# Defects found in use, after the first version

`BUG-*` here, rather than in [`docs/v0.1.0-plan/defects.md`](../v0.1.0-plan/defects.md), which is a
record now. The numbering continues from it: an identifier is never reused, whichever folder it was
minted in. The bar is the same as there — a defect gets a number when it is worth citing later.

What `0.2.0` shipped of it is in [`docs/v0.2.0-plan/defects.md`](../v0.2.0-plan/defects.md).

- [x] **BUG-6** · **Trashing a recording from its own page says it is not there.** After *Trash* is
      confirmed, the page shows *This recording is not here — it may have been deleted, or it may
      never have been yours* for a second or two, and only then opens the library. Somebody who has
      just trashed something on purpose is told, in the words reserved for a recording they cannot
      reach, that it may never have been theirs. It was found by a scripted browser recording the
      website's tour on `0.2.0`, in both themes, about two seconds each time on a local instance.

      The page waited for the cache to settle before it left. `invalidate` refetches every query
      still on screen, the recording's own among them, and `GET /api/audio/{uuid}` answers 404 for
      a recording in the trash, which `RecordingView` draws as *not here*. The library was opened
      only once every refetch had answered. `0.1.0` had the same order and refetched the same key,
      so the defect is not new in `0.2.0`; it was not measured there.

      The page now leaves as soon as the `DELETE` succeeds, and invalidates once it is gone rather
      than once it has asked to go. The two are not the same moment: the router changes the route
      inside a React transition, so the old page stays mounted for a render or two after the address
      has changed, and a refetch answering in that window is drawn on it. Sampled in a real browser,
      leaving first and invalidating straight after still drew it in two runs of six, for 30 to
      70 ms each; invalidating on unmount drew it in none of eight. Keeping the recording's own key
      out of the invalidation was rejected: it leaves a cached copy of a trashed recording to be
      shown the next time anybody opens its address. Turning the router's transitions off was
      rejected too: it would change every navigation in the interface to fix one. Trashing a
      library from its settings was checked the same way and does not flash; it is not part of
      this.

      *Done when:* confirming *Trash* on a recording's page opens its library without the page ever
      drawing what the recording answers once trashed, in a real browser and in a test. 🧪
      *`RecordingActions.test.tsx`, a test in which the recording's answer is held once it is
      trashed: it fails on the code that waited for it.*

- [x] **BUG-7** · **A recording in the trash cannot be opened, so its trashed band is never
      shown.** `UI-11d` promises that a recording in the trash can be played and put back from its
      own page, under a band that says how many days are left, and `TrashedBand.tsx` draws exactly
      that. Nothing reached it. `GET /api/audio/{uuid}` resolved the recording through
      `require_audio` without `include_trashed`, so it answered 404 for a trashed recording, to its
      manager as much as to anybody. Checked on `0.2.0` with the demo administrator, at level 40 on
      one of their own recordings: the detail, the waveform, the transcript, the stream, the
      original and a playback token all answered 404. The page drew that as *This recording is not
      here — it may have been deleted, or it may never have been yours*.

      Nothing in the interface links to that page: the trash view's rows restore and delete, and
      open nothing. What is left is somebody arriving by an address they kept — a bookmark, a link a
      library member sent, a tab left open while somebody else trashed it — and every one of them
      was told the recording may never have been theirs, by an instance that knew otherwise and
      could have offered *Restore* instead.

      The tests did not see it because the mock did not do what the endpoint does:
      `src/test/api/handlers.ts` answered `GET /api/audio/:audio_uuid` with the recording whatever
      its `deleted_at`, so `TrashedBand.test.tsx` passed against a response the instance never
      gave. `BUG-6` hid behind the same gap.

      There were two ways out, and the first was taken: **the API answers a trashed recording to
      somebody who could restore it.** `require_viewable_audio` in `acl/query.py` resolves a live
      recording at read and a trashed one at manage, and the reads the page makes go through it —
      the detail, the waveform, the transcripts, the transcription status, the stream, the original
      and the playback token. It leaks nothing under `DEC-14`: a manager already lists the recording
      in `GET /api/trash/audio`, and anybody below manage keeps the 404. Every write still resolves
      through `require_audio`, so nothing in the trash is edited, favourited or transcribed. The
      other way — admitting the trashed page to be the not-found page and removing `TrashedBand` —
      would have kept the API as narrow as it was, at the price of a promise the plan made and a
      component that already kept it.

      The mock now answers those reads as the endpoint does, live at any level and trashed only
      from level 30, and the two band tests that drew a trashed recording for a reader are replaced
      by one in which a reader is told it is not there. `Player.test.tsx` drew a recording the
      mock archive did not hold, and now draws one it does.

      *Done when:* the mock answers a trashed recording the way the endpoint does, and a manager who
      opens a trashed recording's address sees the band, can play it and can restore it, while
      anybody below `MANAGE` still gets *not here*. 🧪 *`tests/api/test_a_trashed_recording_page.py`,
      every read at each level and the writes refused; `TrashedBand.test.tsx` against the corrected
      mock.*
