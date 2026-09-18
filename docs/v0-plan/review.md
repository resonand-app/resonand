# Backend review

`REV-*` — what a read of the finished backend found, and what each finding was settled with.

The backend half of this plan was declared complete in September 2026, and then read end to end
against what its own docstrings claimed. That produced a worklist rather than a verdict: a
handful of places where the implementation did not deliver what the surrounding paragraph
promised, ordered by what it would cost somebody using the archive.

**The analysis itself is not reproduced here.** It is a working document with severity ratings, an
assessment of the architecture and measurements taken while the code was in front of it, and it is
kept out of the repository for the same reason the interface specification is: a candid reading
stops being candid once it is a published artefact. What belongs here is what a reader of the code
needs — a `REV-` identifier in a commit message or a comment, and what it means.

Findings are **never renumbered**. One that turned out to be a deliberate decision is closed with
the reasoning rather than deleted, and one that produced a second question keeps the parent's
number with a letter (`REV-4` → `REV-4a`).

---

## The write path

- [x] **REV-1** 🔒 · **The write lock spanned the whole HTTP request, and upload sat inside it.**
      For the length of an upload — up to 8 GB — nothing else in the instance could write: no
      metadata edit, no session row, no job claim, no retention purge. Upload now takes no write
      session at all: it mints the identifier, writes and hashes the bytes with nothing open, and
      inserts the row inside one short transaction that resolves the permission a second time.
      Narrowing the lock inside `write_session` to the flush was rejected — SQLite takes its
      reserved lock at the first write statement and not at the commit, so a lock that narrow
      hands `DAT-2`'s guarantee back to `busy_timeout`. 🧪 *A concurrent `PATCH` completes while
      an upload is in flight, and a refused upload leaves nothing behind.*

- [x] **REV-7** · **Double ACL resolution on every write.** Four endpoints called a service
      function that had already resolved the caller's level, then resolved it again purely to
      hand the presenter a number — two extra recursive CTEs per write, inside the write lock.
      They return `(entity, level)` now. `move_audio` resolves twice and must: permissions come
      from the library a recording is in, so the level from before a move reports a permission
      the caller no longer has. 🧪 *A write resolves the permission once, and a move reports what
      the recording carries afterwards.*

- [x] **REV-8** · **The single-writer invariant had no runtime guard.** `instance.starting` logged
      the version and the paths and nothing about how many processes may write. It now names
      where the worker is, and turning the worker off raises a warning: that is the one
      configuration from which somebody reaches a second writer, so it is the only one where a
      line can still change what happens. 🧪

- [x] **REV-11** · **The deployment documentation recommended a second writer process.** Running
      `sonarium work` as its own container against the same volume was documented as "the seam
      that made putting the worker in-process a safe choice". It is a seam for the code and not
      for the database: two processes hold two locks, and `DAT-2`'s guarantee falls back to a
      `busy_timeout` meant for a backup or a `sqlite3` shell. Withdrawn, in the four places that
      recommended it. Buying it properly — a retry around the write transaction, a timeout sized
      for the longest write, a two-process test — was rejected as real work for a topology
      nothing in the first version needs. *The worker moves out when the database does.*

## What a page costs

- [x] **REV-2** · **Every list endpoint counted by hydrating the whole result set.**
      `len(session.execute(query).all())` built every readable recording as an ORM object to
      produce one integer, in a module whose own docstring justifies offset paging on the grounds
      that `COUNT` over an ACL-filtered set is cheap. `count_of()` sits next to `page_of` and is
      used by all four. 🧪

- [x] **REV-3** · **N+1 in the card presenter, beside the code that fixed it.** Tags and share
      flags were batched; the transcription state was asked per card (two queries each) and the
      library row per card — and `session.get(Library, …)` is *not* served from the identity map,
      so fifty cards in one library asked for that row fifty times. Measured at **21 statements
      for five cards, 81 for twenty-five, 156 for fifty**; now nine at any size, and five for the
      library list. The four transcription states stay one decision: the precedence lives in one
      function both the batched and single paths call. 🧪 *A page's cost does not grow with what
      is on it.* The segment count this finding also named was closed by `TRX-12` instead.

## Search

- [x] **REV-4** · **The 500-row cap had no `ORDER BY`.** The results shown were an arbitrary 500
      matches rather than the best 500, and the reported total was the number of groups inside
      that arbitrary slice, so the page count moved between identical queries. Closed by `BUG-1`,
      which reached it from the interface: the grouping, ranking, counting and paging are all the
      database's now and the ceiling is gone rather than larger. 🧪

- [x] **REV-4a** · **Ranking across two corpora was a coincidence.** `bm25` over `segment_fts` and
      over `audio_fts` was compared as though it were one number. The decision taken is that
      **there is no multiplier between the two sides**: `bm25` is bounded by the term's inverse
      document frequency in the corpus it was computed against, so each side answers how unusual
      the word is *there* and the side it is distinctive on wins by itself. A fixed multiplier
      would go on promoting titles in an archive where every recording is called *factory*. What
      changed instead is that the three metadata columns stopped being equal — weighted 10 / 1 / 4
      for title, notes and tags, because unweighted the winner was decided by which field happened
      to be shorter. 🧪 *A name outranks a paragraph whatever the field lengths; saying a word
      throughout still beats having it in a note.*

## What the API claims

- [x] **REV-S5** · **Two endpoints presented a level nobody resolved.** Upload answered `owner`
      for every recording it stored and `restore_library` for every library it un-trashed, when
      uploading needs edit and restoring needs manage. The interface decides what to *offer* from
      that field, so a collaborator was shown sharing and deletion the API would then refuse.
      Both report what they resolved; `create_library` still answers `owner`, because whoever
      creates a library owns it. 🧪

- [x] **REV-S2** · **Two duplicate-check endpoints in two router modules.** The interface asks by
      hash and asks *before* the upload, which is the only ordering that can prevent one; the
      per-recording shape had no caller but its own mock. Removed before `REL-3` documents the
      surface.

- [x] **REV-S4** · **Upload wrote the search-index row twice**, the first before the bytes and the
      final title existed. Closed with `REV-1`.

## Honesty of the documents

- [x] **REV-5** · **Metering was a contract with nothing behind it.** The module said audio-seconds
      were "recorded from the first implementation" and the roadmap said `JOB-2` "already carries
      the metering this would need". There is no `usage` table and no sink outside the in-memory
      one. Settled by saying so rather than by building it: an unused table is three standing
      obligations — `export`, `import` and `fsck` each have to keep it honest — bought for a
      consumer that does not exist. `DEC-10` is a reason for the interface, not for the rows.

- [x] **REV-10** · **All decision provenance pointed at an unpublished document.** Ten thousand
      lines of comments cite `DAT-3`, `DEC-14`, `JOB-13`, which lived in a plan that was not in
      the repository. Closed by the restructure that produced this folder, and by this file: the
      identifiers resolve. A `docs/adr/` restating decisions the plan already carries was
      rejected as a second source of truth for the same facts, and two of those disagree
      eventually.

- [x] **REV-6** · **`validate_segments` was never called on the ingestion path.** A provider
      returning `end_ms < start_ms` wrote segments that seek to the wrong place. `create_transcript`
      calls it now, so the rule belongs to the archive rather than to one path: the sidecar import
      writes segments out of a file somebody else's export produced, which is at least as likely to
      carry impossible timings. 🧪

- [x] **REV-9** · **Export read whole originals into memory**, so `sonarium export` would have run
      out of it on a multi-gigabyte original — in the command that is principle 1's proof.
      `shutil.copyfile`. 🧪

- [x] **REV-S1** · `Level` was re-exported through `db/models.py`, a `core` enum leaking through
      the model module. Removed; no call site moved.

## Open

- [ ] **REV-12** · **Nothing in the instance can tell a client that anything changed.** No SSE, no
      websocket, no cursor to ask "what has changed since". The instance knows the exact moment a
      transcription became readable — `jobs/worker.py` writes `finished_at` — and discards it, so
      every client discovers it by asking again on a timer. A recording being transcribed is
      polled from two places on two clocks and whichever answers first is the one that learns the
      job finished, which is a client reconstructing an event the server already had. The shape is
      `GET /api/events` as SSE, carrying **the identity of what changed and never its contents**,
      resolving the same `MAX()` per subscriber as every other read — an event naming a recording
      somebody cannot read is a permission leak, which is one of the two failure modes this design
      is aimed at. ⇢ REV-11 🧪 *A transcription that finishes updates a connected client with no
      further poll, and a subscriber is never told about a recording it would be refused on `GET`.*

- [ ] **REV-S6** · The code comments are longer than the rule now asks for, almost entirely in the
      frontend. Not worth a pass of its own — the risk of a wholesale rewrite is deleting the one
      comment that was load-bearing. Trim as each file is opened for another reason.

## Named, and deliberately not acted on

- **REV-S3** · The `db/` modules are called repositories but are application services: they
  resolve permissions, enqueue jobs and write the search index. Worth naming honestly before
  `MCP-4`, which requires every MCP tool to be a thin wrapper over an *endpoint* — while these
  services are the real reuse point. Those two pulls will meet; nothing to change until then.
