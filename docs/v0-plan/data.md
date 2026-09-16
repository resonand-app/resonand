# Data and permissions

`DAT-*` — the schema, the migrations, and the one query that every read and every write
resolves through.

## Phase 1 · Data and permissions core 🔒

**The bottleneck of the project.** Nothing that touches data can be written before it. The ACL
query is the only source of truth for permissions and everything goes through it.

- [ ] **DAT-1** 🔒 · Initial Alembic migration: the schema from the specification plus the seven
      deltas listed under **What the first migration contains** — the `session` table, the metadata
      FTS5 table, `library.uuid`, `user.email_normalised`, `audio.recorded_at_offset`,
      `library.colour` and `user.language`. Partial
      indexes, the composite FK `(category_id, library_id)` and the `share` `CHECK` included; none
      of it gets added "later". Timestamps follow the `DEC-11` convention from the first row
      written.

- [ ] **DAT-2** 🔒 · Connection layer: `PRAGMA journal_mode=WAL`, `foreign_keys=ON`,
      `busy_timeout`, `synchronous=NORMAL`. **A single serialised writer** inside the process;
      concurrent reads free. ⇢ DAT-1
      🧪 Load test that fires N simultaneous writes and checks that none gets `SQLITE_BUSY`.

- [ ] **DAT-3** 🔒 · **The ACL CTE** as the single entry point to `audio`. No other part of the code
      queries `audio` directly. ⇢ DAT-2
      🧪 Exhaustive test matrix: owner, library share, individual share, both at once (the highest
      wins), deleted library, deleted audio, disabled user. **This test is the most important one
      in the repository.** Individual sharing has no interface in v0, but the resolution is tested
      from day one.

- [ ] **DAT-4** · Repositories/queries for `library`, `category`, `tag`, `transcript`, `segment`,
      all with the required ACL level as a mandatory parameter. ⇢ DAT-3

- [ ] **DAT-5** · User creation → creates the non-deletable `is_personal = 1` personal library,
      within the same transaction. ⇢ DAT-4
      🧪 There must be no path that creates a user without a personal library.

- [ ] **DAT-6** · Tag normalisation (`slug` lowercase and without diacritics), **first writer
      owns the display name** on a slug collision, and **ACL-filtered** autocomplete offering the
      canonical name — tag names must not leak information between accounts. ⇢ DAT-4 🧪

- [ ] **DAT-7** · Category tree with `parent_id`: creation, rename, reorder and move, with cycle
      detection and per-level uniqueness. ⇢ DAT-4 🧪

- [x] **DAT-8** · **No seed ships in the package.** A seeded archive writes `storage_path` rows
      naming files that were never written: right for a test, wrong for an instance somebody is
      going to click through, where nothing plays and no waveform is drawn. The demo archive is
      built outside the repository by the local development layer, through `sonarium import` and
      the real probe and waveform jobs, so a recording in it is indistinguishable from one
      somebody uploaded. Tests construct exactly the rows they assert on. ⇢ DAT-5

---
