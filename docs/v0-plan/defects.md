# Defects found in use

`BUG-*` — faults found by using the archive rather than by reading it, which is why they are not
in any other track: nothing here was planned, and each one is a thing that had already shipped.

A defect gets an identifier here when it is worth citing later — because a test now guards it,
because the fix changed a decision, or because the reason it survived the quality gate says
something about the gate. Anything smaller is a commit and nothing more.

---

- [x] **BUG-1** · **Search returned a fraction of what matched, and a confident number under it.**
      An archive with three hundred recordings containing a word answered a hundred, the pages
      after the fifth were empty, and narrowing by duration or tag filtered whichever hundred had
      come back rather than the three hundred that matched.

      The cause was where the work happened. Grouping the two indexes into one list per recording
      was done in Python, which meant the matches had to be *in* Python, which meant a ceiling on
      how many were fetched — and the ceiling sat on a compound select with no ordering, so which
      results existed at all was whatever order SQLite produced that day. The total was counted
      after the truncation and the filters applied after it too. So the grouping, the ranking, the
      counting and the paging all moved into the database and the ceiling went rather than getting
      a larger number: raising it would have kept every one of these faults and moved the point
      where they appear somewhere harder to reach.

      The cost is three queries where there was one, and a count over every match rather than over
      five hundred of them. On an archive of two thousand recordings and four hundred thousand
      segments, with a word in every one of them, a page takes about a second and the fiftieth
      page costs what the first does. 🧪 *`tests/db/test_search_completeness.py`, whose fixture is
      deliberately larger than the ceiling that used to exist — every assertion in it passed on
      the old code with three recordings in the fixture, which is how this survived a suite that
      already covered ranking, grouping, filtering and the ACL.*

      This is also `REV-4`, found independently by a read of the backend. The half it did not
      settle — how two corpora scored with one function compare — is `REV-4a` in
      [`review.md`](review.md).

---

- [x] **BUG-2** · **The number beside Trash counted half of what was in the trash.**
      Sending a library there moved it and left the badge where it was; opening the trash showed
      the library sitting in it. Sending a *recording* did move the number, which is what made
      this look like a refresh that had not fired rather than a count asking the wrong question.

      It came from `GET /api/trash/audio` and nothing else. The trash holds two kinds of thing
      and the screen already knew that — `useTrash` sums both endpoints' `total` for the view —
      so the badge and the list it opens were two answers to one question, and the badge was the
      one somebody reads first. It now asks the second endpoint too, at `limit: 1` like the
      first, and adds them.

      Invalidation was never the fault, which is worth saying because it is where the eye goes:
      trashing a library already marks `['trash']` stale and that is a prefix of both keys. The
      number moves the instant it has both halves to add, and a second `limit: 1` request on
      every screen is the whole cost. 🧪 *`src/app/shell/tests/AppShell.test.tsx`, which covered
      the trash entry when the trash was empty and nowhere else — the one case in which a
      missing half cannot show.*

---

- [x] **BUG-3** · **The transcription check said nothing while it ran, and forgot what it found.**
      Pressing *Check it can transcribe* left a control that looked pressed and idle for as long
      as the engine took to answer — several seconds on a cold model, and longer on one that was
      not there. Then the verdict it produced lasted until the next time the panel was read:
      leaving Administration and coming back showed *Not checked yet* again, over a provider
      somebody had just confirmed works.

      The second half is the interesting one, because nothing was refetching too eagerly. The
      check's answer was written over the cached `GET /api/admin/transcription`, and that endpoint
      answers `reachable: null` **by design** — the instance holds no record of a check, because
      running one on a read is precisely what principle 2 forbids. So the verdict was stored in
      the one place guaranteed to be overwritten with its own absence, and any of the three
      ordinary reasons to read again — thirty seconds elapsing, the window regaining focus,
      anything administrative being invalidated — was enough to do it.

      It now has a cached thing of its own, `['admin', 'transcription', 'check']`, which nothing
      fetches: `skipToken` is what makes an `['admin']` invalidation walk past it rather than try
      to refresh it from an endpoint that cannot answer the question, and signing out is the only
      thing that clears it. It carries the moment it was asked, and the panel shows it — a verdict
      that survives a navigation is a claim about the past, and one with no time on it reads as a
      claim about now.

      The first half is a `busy` state on `Button`, which is `FBK-6`'s exception to the system's
      refusal to animate applied to a control rather than a card, and on the same grounds: it
      turns only while a request somebody pressed is genuinely in flight, and it claims no
      fraction. 🧪 *`src/features/settings/administration/tests/Provider.test.tsx`, whose
      persistence case mounts the panel a second time on the first one's cache, after the
      configuration read has landed — a second mount alone passes on the old code, because the
      stale verdict is on screen until the refetch resolves.*
