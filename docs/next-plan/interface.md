# The interface, after the first version

`UI-*` — views and the design system under them, for what the first version did not build. Its
record is [`docs/v0.1.0-plan/interface.md`](../v0.1.0-plan/interface.md), and the numbering
continues from it: an identifier is never reused, whichever folder minted it.

Anything visual is verified in a browser, not only in jsdom, and every string lives in
`src/i18n/en/`.

## Favourites

The feature is introduced in [`data.md`](data.md), beside `DAT-11`. **No copy for it exists in
`docs/internal/`**, which was written before favourites were anything but a line on the roadmap.
The strings these tasks need — the heart's two labels, the view's title, its empty state, the
bulk actions, a failure — are drafted in the task against the design system's content rules, and
reviewed as copy in its pull request rather than taken as settled.

- [x] **UI-41** · **A heart, in the design system.** `heart` joins `Icon`'s registry, and the
      ICONOGRAPHY list in `design-system/README.md` and `Icon.test.tsx`'s documented names follow
      it. A marked recording draws the heart **filled**, which `Icon` cannot do today: it strokes
      every glyph at 1.7 and fills none. The filled state takes the accent from a token, never from
      the component, and is checked by the contrast audit in both themes.

      `RecordingCard` and `RecordingRow` take an optional `favourite` — whether it is marked, and
      what to call when it is pressed — and draw nothing when it is absent, as `sharedIndividually`
      already works. The control is an `IconButton` with `aria-pressed`, a 44px target and the
      visible focus treatment, placed where it cannot be confused with the play button. Each
      component's `.prompt.md` says when not to draw it, and `#/specimens` shows both states in
      both themes.

      *Done when:* both components draw a marked and an unmarked heart that pass the contrast
      audit, from tokens alone, and nothing changes for a caller that does not pass `favourite`.

- [x] **UI-42** · 🧪 **Marking a favourite from wherever a recording is.** The heart on every card,
      every row, and in a recording's header beside its other actions. **Unlike every other action
      it is drawn on everything the caller can read**, a library shared read-only included, because
      the mark belongs to the person making it and asks nothing of the recording.

      It is optimistic: the heart changes at once, `PUT` or `DELETE` follows, and a failure puts it
      back and says so in a toast. `invalidate.ts` gains a `favourite` change, which refreshes the
      recording and the favourites listing and leaves the library grid alone, since the grid's own
      copy of the row was already corrected in place.

      The library's bulk bar gains *Add to favourites* and *Remove from favourites*, through
      `runBulk` like the others. That means a library somebody only reads **now has a selection**,
      offering those two actions and nothing else. It reverses the reason `UI-9a` gave for leaving
      the checkboxes out there — a grid of checkboxes with nothing to do reads as a bug — because
      there is now something to do.

      🧪 Pressing the heart flips `aria-pressed` and sends `PUT`, then `DELETE`; a refused request
      restores the heart and shows the toast; a read-only recording draws the heart and none of the
      other actions; selecting in a read-only library offers exactly the two favourite actions, and
      they apply to every row selected. Exercised in a browser. ⇢ API-26, UI-41

      *Done when:* a recording can be marked and unmarked from its card, its row and its own page,
      in any library the caller can read, one at a time or as a selection.

- [x] **UI-43** · 🧪 **The grid and the list draw recordings from more than one library.** Both
      assume one today: `RecordingGrid` takes a single `libraryName` and a single `categories`, and
      `RecordingList`'s pages are fixed to `/api/libraries/{uuid}/audio` in `rows.ts`, as is the
      select-all that `fetchEveryRecording` performs. Each row now carries its own library: the name
      resolved from its `library_uuid` against `useLibraries`, and its category against that
      library's categories, fetched per distinct library on the page and cached under the key the
      library view already uses. The source of the rows, the list's pages and select-all is passed
      in rather than built inside.

      A row whose library the caller cannot read — a recording shared with them on its own, which
      `library_acl` deliberately does not turn into access to its library — **shows no library name
      rather than a wrong one**, and the player says nothing under the title for it. Naming that
      library is the roadmap's open question under *What "shared" means*, and not this task's.

      This is also the grid that *Shared with me* will need.

      *Cost, named:* a page of favourites from five libraries fetches five category trees the first
      time. They are small, cached, and usually already fetched by having opened those libraries.

      🧪 A grid and a list over rows from two libraries name each row's own library and category;
      a row from a library not in the caller's list shows neither; every existing library-view test
      passes unchanged.

      *Done when:* a library view behaves exactly as before, and the same components can be handed
      a listing that spans libraries.

- [x] **UI-44** · 🧪 **Favourites, in the sidebar.** A route, `/favourites`; a destination,
      `favourites`, in `destinations.ts`; and an entry in the design-system `Sidebar` below Search
      and above *Your libraries*. `Sidebar`'s layout is fixed and has no slot for one, so the entry
      is added to the component, its labels and its specimen, collapsed and expanded. On a phone it
      sits on the libraries screen beside the way to Trash. The view, `features/favourites/`, is
      registered in `test/support/views.tsx`.

      It lists `GET /api/audio?favourite=true` through `useInfinitePages`, under a key of its own,
      in the grid or the list `UI-43` made. The filter bar is the library's without the category
      tree, which belongs to one library; the sort adds **Recently favourited**, the default,
      before the library's own, and all of it lives in the URL like the library's.

      **Unmarking a card here does not take it away.** It stays where it is with an empty heart,
      so the same click undoes a mistaken one, and it is gone the next time the view loads. Removing
      it at once would reflow the grid under the pointer.

      Selection offers, **per action, only what every selected recording allows**, read from each
      row's `level`:

      | Action | Drawn when |
      |---|---|
      | Remove from favourites | Always — it needs read, and every row here is readable |
      | Tag | Every selected row is at Can edit or above |
      | Category | Every selected row is at Can edit or above **and** they sit in one library |
      | Move | Every selected row is at Can manage or above (`DEC-27`) **and** they sit in one library |
      | Trash | Every selected row is at Can manage or above (`DEC-27`) |

      So a selection of recordings the caller only reads offers *Remove from favourites* and
      nothing else, and one read-only row in a selection of editable ones takes Tag and Category
      away until it is deselected. Absent, never disabled (§3.5).

      The move asks for one library as the category does, for a reason found while building it:
      the move dialog names who gains and who loses access against the library the recordings
      leave, and a selection from two libraries would have it name the wrong people for half of
      them.

      The page header names the view and how many recordings it holds. The empty state says how a
      recording gets here — the heart on any card — rather than apologising; loading and failure
      are the library's states. Trashing, moving or unmarking anything invalidates the listing.

      🧪 The view lists favourites from more than one library and nothing else; unmarking keeps the
      card until the next load; the bulk actions follow the table for a read-only selection, a
      mixed one, an editable one in one library, an editable one across two, and a managed one;
      the empty state; the route and the sidebar entry on desktop and phone. Exercised in a browser
      on an archive with a library shared with the caller. ⇢ API-27, UI-42, UI-43, DAT-10

      *Done when:* every recording somebody has marked and can still read is one click from
      anywhere, and nothing on that page offers what the API would refuse.
