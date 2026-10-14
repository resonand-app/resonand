# Data and permissions, after the first version

`DAT-*` — the schema, the migrations, and the one query every read and every write resolves
through. What the first version built is recorded in
[`docs/v0.1.0-plan/data.md`](../v0.1.0-plan/data.md), and the numbering continues from it: an
identifier is never reused, whichever folder minted it.

## Who may do what

- [ ] **DAT-10** · 🧪 **Taking a recording out of a library needs Can manage.** `DEC-27`, applied
      on both sides at once, because either half alone ships a button the other half refuses.

      In the access layer, `db/audio.py`: trashing, restoring and purging a recording resolve at
      `Level.MANAGE` rather than `Level.EDIT`, and so does the trash listing, so that an editor is
      never shown a row they could not act on. A move resolves manage on the recording and keeps
      edit on the destination. Upload, metadata, category and tags are untouched. A caller who can
      read the recording and is refused one of these gets `403`, as `require_audio` already
      answers above read: they know it exists, so a `404` would be a lie rather than a precaution.

      The wording in `resonand.core.levels` says what each level now allows — an editor changes
      titles, notes, dates, categories and tags; a manager also moves, trashes and shares — so that
      `UI-17`'s sharing panel describes the same thing the API enforces. The docstrings on `Level`
      follow it.

      In the interface: Move and Trash on a recording are drawn at manage, not edit, in
      `RecordingActions` and in the library's bulk bar, and Restore and Delete now in the trash
      only for what the caller manages. Absent rather than disabled, as everywhere else (§3.5).
      `RecordingActions`' docstring, which states the old levels, is corrected on the way past.

      `CHANGELOG.md` gets the entry `DEC-27` asks for, under *Changed* and in plain words:
      somebody given Can edit can no longer move a recording out of a library or send it to the
      trash, and an owner who wants them to raises them to Can manage. `API.md` and the user guide
      (`REL-8`), wherever either describes the levels, say the same. ⇢ DEC-27

      🧪 An editor is refused trash, restore, purge and a move out, with `403`; a manager is not;
      an editor still moves a recording *in* from a library they manage; an individual grant at
      manage is enough; the trash lists nothing an editor cannot restore. In the interface, a
      recording and a library selection the caller only edits draw neither Move nor Trash.

      *Done when:* no path through the API or the interface lets somebody with Can edit make a
      recording leave a library, and the words a person reads before granting a level say so.

## Favourites

What [`ROADMAP.md`](../../ROADMAP.md) called *favourites, kept with a heart*: a mark one account
puts on a recording it can read, and a place in the sidebar that gathers every marked recording
whichever library it sits in. The place is a destination and **not a library**. A library is the
unit of ownership and of permission, and a recording sits in exactly one; a row in `library` that
held recordings from five others would be a second permission model wearing the first one's name.
The tasks are `DAT-11` here, `API-26` and `API-27` in [`api.md`](api.md), `ING-15` in
[`ingestion.md`](ingestion.md), and `UI-41` to `UI-44` in [`interface.md`](interface.md).

- [ ] **DAT-11** · 🧪 **A recording can be marked as a favourite, by the account that marks it
      and for nobody else.** Migration `0005_favourites`: a `favourite` table of `user_id`,
      `audio_id` and `created_at`, the pair as the primary key, both foreign keys
      `ON DELETE CASCADE`, an index on `audio_id` for the cascade, and `created_at` an instant in
      UTC under `DEC-11`. The model beside it, so `test_models_match_migration.py` holds.

      A module of its own, `db/favourites.py`, marks and unmarks. Both resolve the recording
      through `require_audio` at read — **a favourite needs nothing more than being able to see
      the recording** — and both are idempotent: marking twice leaves one row, unmarking what was
      never marked is not an error. Something the caller cannot read, or that is in the trash, is
      not found, and no row is written.

      `apply_filters` gains a `favourite` filter, an `EXISTS` on the caller's own row, so the grid
      and search can both ask for it; and `favourited_at` becomes an ordering the cross-library
      listing can offer (`API-27`).

      **What happens to the mark falls out of the ACL rather than out of code.** Trashing the
      recording hides it, restoring it brings it back, purging it deletes the row by cascade, and a
      move keeps it, because the mark points at the recording and not at its library. **Losing
      access keeps the row and hides it**: every read joins `audio_acl`, so a revoked grant takes
      the recording out of the caller's favourites, and the same grant given back returns it
      still marked. A row nobody but its owner can ever read leaks nothing, and dropping it instead
      would mean a clean-up in every path that revokes, moves or trashes a library — of which none
      publishes an event to hang one on.

      *Rejected:* a flag on `audio`, which would be one person's favourite for everybody.
      *Rejected:* a count, anywhere. How many people marked something is information about other
      accounts, and the first version is careful never to give any out.

      🧪 Marking twice leaves one row and unmarking twice is not an error; a recording the caller
      cannot read is not found and writes nothing; the filter returns the caller's readable
      favourites across libraries and nobody else's; a revoked grant hides a favourite and a
      restored one returns it; trashing hides and restoring returns; purging the recording or
      deleting the account removes the row; the upgrade test walks `0005`.

      *Done when:* an account's favourites are a set of recordings it can read right now, no query
      can tell anybody else what is in it, and nothing but the cascade ever deletes from it.
