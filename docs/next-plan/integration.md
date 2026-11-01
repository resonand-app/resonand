# Integration and cross-cutting views, after the first version

`INT-*` — the work that needs two finished tracks at once. What the first version built is
recorded in [`docs/v0.1.0-plan/integration.md`](../v0.1.0-plan/integration.md), and the numbering
continues from it: an identifier is never reused, whichever folder minted it.

## Confirming a permanent deletion

`DEC-28` in [`decisions.md`](decisions.md) replaces the typed name with an ordinary dialog. These
two tasks apply it: to the deletion that exists, and to the bulk deletion that does not yet.

- [x] **INT-7** · 🧪 **Delete now asks once, in words, and nothing is typed.** Raised as #69.
      `TrashRow`'s `TypedConfirm` becomes a `Dialog` inside a `Modal`, as `TrashLibraryDialog`
      already is, for a recording and a library alike. Its copy follows `DEC-28`: a title that says
      *permanently* and names the item, the name drawn apart from the sentence, no description,
      Cancel and a danger *Delete permanently*, and **the initial focus on Cancel**, through the
      overlay's existing initial-focus marker. A name wraps inside the title
      rather than running past the dialog's edge, with `overflow-wrap: anywhere`, and stays whole —
      never clipped, since the title is how somebody checks they pressed the right row. Every
      string lives in `src/i18n/en/`, which `TypedConfirm`'s English, written inside the design
      system, never did.

      **`TypedConfirm` leaves the design system**, since nothing else mounts it: the component,
      its `.prompt.md`, its test, `name-match.ts`, its block in `components.css`, its export from
      `index.ts`, its specimen, its row in `design-system/README.md` — whose count of the
      specification's components drops by one — and its half of the guard in
      `every-view-is-audited.node.test.ts`, which then holds every module mounting a `Modal`. The
      docstrings that cite it as the irreversible gesture — `TrashRow`, `TrashLibraryDialog`,
      `LibrarySettingsView`, `Modal`, `Dialog`'s test, `tag-names.ts` — are corrected on the way
      past, to say what `DEC-28` says instead. `UI-34m` in the first version's record is left as
      written: it is what was built then.

      `CHANGELOG.md` says it under *Changed*: deleting from the trash asks for a confirmation and
      no longer for the name. ⇢ DEC-28

      🧪 Nothing is destroyed until the danger button is pressed; Enter pressed as the dialog
      opens cancels rather than destroys; Escape cancels; the name is drawn apart inside the title,
      and nothing is said under it. Checked in a browser with a 200-character title, with and
      without spaces, in both themes.

      *Done when:* no permanent deletion in the product asks for a name, and nothing imports
      `TypedConfirm`.

- [x] **INT-8** · 🧪 **The trash can be emptied, whole or in part, with one confirmation.** Rows in
      the trash can be selected, as recordings in a library can, and a selection replaces the
      view's header with the `BulkBar`, whose one destructive action is *Delete permanently*. When
      the trash is not empty, its header also offers *Empty trash*. Both open one dialog, under
      `DEC-28`'s rules: the title counts what goes — from the selection for a part, from
      `GET /api/trash/summary` for the whole, since the list is paged — and the initial focus is
      on Cancel.

      A library's row selects what it groups, and a recording inside a selected library is counted
      once, as `API-28` counts it. *Empty trash* sends the summary's instant as `trashed_before`,
      so something trashed in another tab while the dialog was open survives it. After either, the
      list, the sidebar and every count that included what went are invalidated, and the view says
      how many items went in a toast rather than leaving an emptier list to speak for itself.

      Restoring in bulk is not part of this: Restore stays one call per item, which `INT-1c`
      decided and nobody has yet asked to change. ⇢ API-28, INT-7

      🧪 The bulk bar replaces the header at the same height; the dialog's count is the
      selection's, or the summary's when emptying; nothing goes before the danger button; Enter on
      open cancels; a library and one of its recordings, both selected, count once; the list is
      empty after *Empty trash*, and shows the trash's good empty state. Checked in a browser on
      the full demo archive and with `extras.sh`'s trashed library.

      *Done when:* somebody can destroy any part of their trash, or all of it, with one
      confirmation that stated what it would destroy in numbers.
