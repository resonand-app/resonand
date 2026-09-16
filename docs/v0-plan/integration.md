# Integration and cross-cutting views

`INT-*` — the work that needs two finished tracks at once: the trash, administration, and the
passes over the whole product rather than over any one view. What a view has to do and what the
backend behind it owes are kept together, because splitting them is how the trash came to mean
two different things in two places.

## Phase 4 · Integration and cross-cutting views

Everything that needs two finished tracks at once.

- [ ] **INT-1** · **View I · Trash**: deleted audios and libraries with the time they have left,
      restore and delete now, against a 30-day default retention. Permanent deletion requires
      **typed confirmation**, which states exactly what is destroyed. Recordings and libraries are
      **one list with a type marker**: the question somebody arrives with is where a thing went, not
      whether it was a library. ⇢ UI-9, API-8, API-14 🧪

- [ ] **INT-2** · Scheduled trash purge at the configured retention (30 days by default, per
      instance), as a recurring job, also deleting the files from `storage/`. ⇢ INT-1, JOB-1 🧪

- [ ] **INT-3** · **View H · Administration**, a section inside `UI-20`'s Settings shown only when
      `is_admin`, and **visually separated inside it so nobody wanders in by accident** — its own
      chrome rather than its own destination: users (list, create, disable, re-enable — **deleting a
      user with content is refused in v0**, with a message saying why, which has to read as a
      considered position and not a bug), transcription provider (configuration, connection test,
      status, and what leaves the instance and to where), job queue (pending, running, failed,
      retry, cancel, with the real error text on a failed job), and system status (space used,
      recording count, index size, and the schema revision against the one the image expects).
      An empty queue is the healthy case and should look healthy rather than empty.
      ⇢ UI-20, API-7, JOB-1

- [ ] **INT-5** · Security pass: signed URLs, size limits, login rate limiting, and verification
      that **no endpoint has escaped `API-2`**. ⇢ every track 🧪
      🧪 Test that enumerates every route and fails if any of them skips the ACL.

- [ ] **INT-6** · End-to-end tests (Playwright) of the paths that matter: upload → transcribe →
      search → play from the result; share a library → the other user sees it at the correct level;
      move between libraries → who can see it changes. ⇢ INT-5

---


### E.9 · V9 · Trash and Administration (INT-1, INT-3)

- [x] **INT-1a** · One list with a type marker, **not two sections** — the question is where a thing
      went, not whether it was a library. Sorted closest to being purged first, with the time left
      per item computed from the retention on `/instance`. ⇢ UI-4a, API-14
- [x] **INT-1b** · A trashed library and its children grouped, and the hard case answered on screen:
      restoring one child alone puts it back in a library that is still in the trash, where you
      would not see it. ⇢ INT-1a, API-14
- [x] **INT-1c** · Restore, one call per item; and Delete now through `TypedConfirm`, stating
      exactly what is destroyed. ⇢ INT-1a, UI-34m, API-19
- [x] **INT-1d** · The states: items in their last day marked unmistakably, loading, and empty —
      where the good state reads as reassurance rather than as absence. ⇢ INT-1a, UI-35c
- [x] **INT-3a** · Administration's own chrome inside Settings, so nobody wanders into it: it runs
      the instance for everybody on it, and it says so. ⇢ UI-20a, API-7
- [x] **INT-3b** · Users: create, disable, re-enable, and the **refusal to delete an owner that
      names the libraries and recordings in the way**. Transferring content between accounts is a
      later task, so until then an account can be disabled but not deleted. ⇢ INT-3a, API-7,
      API-20
- [x] **INT-3c** · The transcription provider: its fields, the egress notice in its calm register,
      and a test that is **explicit and never automatic** — opening the page contacts nothing. Plus
      the no-provider state, which says plainly that nothing on this instance can be transcribed.
      ⇢ INT-3a, UI-34n, API-7
- [x] **INT-3d** · The job queue: real errors, `attempts`, and `ready_at` rendered as when the next
      attempt happens; retry and cancel; and an aggregate panel instead of four hundred rows when
      the queue is long. ⇢ INT-3a, JOB-1
- [x] **INT-3e** · System status, with **the revision comparison as the loudest thing on the page**
      when the database is not where the build expects it — writes may fail or lose data until the
      migrations run. ⇢ INT-3a, UI-35e, API-7

---


### The passes over the finished interface

Reached at the end of the frontend track, and recorded here because what
they cross is the whole product rather than any one view.

- [x] **INT-5** · The security pass over the finished client: no token in a URL that persists, no
      privileged path, and the 404-not-403 rule holding everywhere. ⇢ UI-3b
- [ ] **INT-6** · 🧪 Playwright over **the utility threshold itself**: put audio in, have it
      transcribed, find a specific moment by searching everything, and play from that moment. If
      that path passes, the interface does the thing the product exists to do.
      **Deferred, not skipped** — it is the one task here that needs a browser and a live
      instance rather than jsdom, so it follows the backend review worklist and lands against a
      backend that has settled. ⇢ every view
