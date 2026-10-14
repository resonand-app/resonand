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
