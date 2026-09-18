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
