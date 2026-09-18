# Data and permissions

`DAT-*` — the schema, the migrations, and the one query that every read and every write
resolves through.

## Phase 1 · Data and permissions core 🔒

**The bottleneck of the project.** Nothing that touches data can be written before it. The ACL
query is the only source of truth for permissions and everything goes through it.

- [x] **DAT-1** 🔒 · Initial Alembic migration: the schema from the specification plus the seven
      deltas listed under **What the first migration contains** — the `session` table, the metadata
      FTS5 table, `library.uuid`, `user.email_normalised`, `audio.recorded_at_offset`,
      `library.colour` and `user.language`. Partial
      indexes, the composite FK `(category_id, library_id)` and the `share` `CHECK` included; none
      of it gets added "later". Timestamps follow the `DEC-11` convention from the first row
      written.

- [x] **DAT-2** 🔒 · Connection layer: `PRAGMA journal_mode=WAL`, `foreign_keys=ON`,
      `busy_timeout`, `synchronous=NORMAL`. **A single serialised writer** inside the process;
      concurrent reads free. ⇢ DAT-1
      🧪 Load test that fires N simultaneous writes and checks that none gets `SQLITE_BUSY`.

- [x] **DAT-3** 🔒 · **The ACL CTE** as the single entry point to `audio`. No other part of the code
      queries `audio` directly. ⇢ DAT-2
      🧪 Exhaustive test matrix: owner, library share, individual share, both at once (the highest
      wins), deleted library, deleted audio, disabled user. **This test is the most important one
      in the repository.** Individual sharing has no interface in v0, but the resolution is tested
      from day one.

- [x] **DAT-4** · Repositories/queries for `library`, `category`, `tag`, `transcript`, `segment`,
      all with the required ACL level as a mandatory parameter. ⇢ DAT-3
      *As built, the level is a parameter on `library`, `category` and `audio`; `transcript`,
      `segment` and the tag writes take none, because they are reachable only through a recording
      the caller has already resolved. The invariant is the same one, enforced a layer earlier —
      `tests/api/test_no_route_escapes_the_acl.py` is what holds it.*

- [x] **DAT-5** · User creation → creates the `is_personal = 1` personal library, within the same
      transaction. ⇢ DAT-4
      🧪 There must be no path that creates a user without a personal library.
      *It was specified as non-deletable, and `DAT-9` moved that guarantee off the flag and onto
      the count.*

- [x] **DAT-6** · Tag normalisation (`slug` lowercase and without diacritics), **first writer
      owns the display name** on a slug collision, and **ACL-filtered** autocomplete offering the
      canonical name — tag names must not leak information between accounts. ⇢ DAT-4 🧪

- [ ] **DAT-7** · Category tree with `parent_id`: creation, rename, reorder and move, with cycle
      detection and per-level uniqueness. ⇢ DAT-4 🧪
      *Outstanding: only the rename half of the test. Creation, move with cycle detection at both
      the repository and the HTTP layer, reorder, and per-level uniqueness are covered;
      `rename_category` is exercised by nothing at any layer, which is what the marker is for.*

- [x] **DAT-8** · **No seed ships in the package.** A seeded archive writes `storage_path` rows
      naming files that were never written: right for a test, wrong for an instance somebody is
      going to click through, where nothing plays and no waveform is drawn. The demo archive is
      built outside the repository by the local development layer, through `sonarium import` and
      the real probe and waveform jobs, so a recording in it is indistinguishable from one
      somebody uploaded. Tests construct exactly the rows they assert on. ⇢ DAT-5

- [x] **DAT-9** · **The last library an account owns cannot be trashed — the personal one can.**
      What `audio.library_id NOT NULL` actually rests on is that there is always somewhere for a
      recording to go, and that is the count being at least one, not the `is_personal` flag: an
      upload names its destination and a trashed library takes its recordings with it, so nothing
      was ever routed to the personal library by default. Refusing on the flag therefore bought
      nothing and cost somebody a folder called Personal they did not want. The question is asked
      of the **owner** rather than of the caller, because manage is grantable. `is_personal`
      stays, and is now only what puts a library first in a list. ⇢ DAT-4, DAT-5
      🧪 An account's last library is refused, the personal one goes once a second exists, and the
      one that remains is refused in its turn.

---
