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

- [ ] **UI-44** · 🧪 **Favourites, in the sidebar.** A route, `/favourites`; a destination,
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
      | Move, Trash | Every selected row is at Can manage or above (`DEC-27`) |

      So a selection of recordings the caller only reads offers *Remove from favourites* and
      nothing else, and one read-only row in a selection of editable ones takes Tag and Category
      away until it is deselected. Absent, never disabled (§3.5).

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

## How long a name can be

The limits are decided in [`data.md`](data.md), beside `DAT-12`.

- [x] **UI-45** · 🧪 **A field says how long a name can be before the API has to.** Every field
      that edits a recording's title or a library's name — the metadata panel's `InlineField`, the
      create-library dialog, a library's settings — carries `maxLength` at the limit `DAT-12`
      sets, so a name over it cannot be typed or pasted, rather than being refused on save. The
      two numbers live in one module in `src/`, and a `*.node.test.ts` holds them against the
      `maxLength` the committed `openapi.json` declares, so the interface cannot drift from the API
      the way the generated types are held to it today.

      `maxLength` counts UTF-16 code units and the API counts code points, so a name full of emoji
      is held a little shorter in the field than the API would accept. That is the safe direction,
      and it is left alone: the field never lets through something the API refuses.

      A `422` from either endpoint still lands as a field error with copy in `src/i18n/en/`, for a
      client that is not this interface and for the race the field cannot see.

      Long names are drawn where they appear — a card, a row, the sidebar, a dialog title — without
      running past their container: `overflow-wrap: anywhere` where a name wraps, and the ellipsis
      already in place where it does not. Checked in a browser at 200 and 100 characters, with and
      without spaces, in both themes. ⇢ DAT-12

      🧪 A title field refuses a 201st character; a library name field a 101st; the node test fails
      when either number disagrees with `openapi.json`.

      *Done when:* no field in the interface accepts a name the API would refuse for its length,
      and no view draws a name at either limit outside its container.

## Saying what happened, and then getting out of the way

The bulk bar reports a run with `BulkReport`, a `StateCard` drawn between the bar and the grid that
stays until somebody presses *Dismiss*. A run where everything succeeded therefore leaves a card
over the grid for good news nobody has to act on, and the next run cannot start without first
clearing the last one's report out of the way. This is not what the first version designed:
`BulkBar`'s own docstring, `UI-9c`'s dependency on `UI-34h` and `UI-35f`, and the second example in
`Toast.prompt.md` — "9 moved, 3 failed. The three that failed are still selected." — all describe a
toast. The card is where the build drifted from the plan.

The toast host exists since `FBK-1`, but only a failed write raises one. Nothing raises a success,
so a recording sent to the trash from its own page, a recording moved, or a library sent to the
trash ends in silence: the dialog closes and the screen changes, and whether that was the action
working is left to be inferred.

**A toast that carries a button stays longer.** It is the region's own rule — "an action nobody had
time to read is an action nobody was offered" — applied to success as well as to failure: a plain
success goes after the region's six seconds, a success with an action after twelve, and a failure
with an action stays until it is dismissed. Every timer **pauses while the pointer or the focus is
inside its toast**, so reaching for *Undo* never races the clock.

**Undo is offered only where it is an exact inverse.** Sending to the trash is undone by restoring,
which puts back everything the deletion took. Moving is not offered one: a move drops the
recording's category, and moving it back would not bring the category with it — an *Undo* that
undoes part of something is a promise the button cannot keep.

No copy for any of this exists in `docs/internal/`. The strings are drafted in the tasks against
the design system's content rules — a number where there is one, no exclamation mark — and reviewed
as copy in their pull requests.

- [ ] **UI-46** · 🧪 **A bulk run reports itself in a toast.** The toast store's `RaisedToast` gains
      one optional action, a label and what to call, and `Toast` draws it for either tone; pressing
      it takes the toast away and runs. `ToastRegion`'s timer pauses on hover and on focus within.
      The timeouts are the section's: six seconds plain, twelve with an action, and a failure with
      an action stays.

      `BulkReport` goes, and `useBulk` raises the toast where the run ends, so that every view
      holding a bulk bar reports the same way without rendering anything. All succeeded is a `done`
      toast in the words the card used. Some failed is a `failed` toast saying how many of each,
      the grouped reasons, and that the failures are still selected, with *Retry N* acting on
      exactly those. A trash run that moved anything carries *Undo*, which restores what it moved
      through the same run and reports itself the same way.

      *Cost, named:* the favourites stack (#51, #58, #59) renders `<BulkReport>` in the view it
      adds, so whichever of the two lands second deletes that line when it is rebased.

      🧪 A run that succeeds raises one `done` toast and draws no card; a run where a third fail
      raises one `failed` toast with *Retry N*, leaves those selected, and its retry runs on them
      alone; *Undo* after a trash restores what went; a toast with an action outlives a plain one;
      a timer does not fire while the toast is hovered or focused. Exercised in a browser.
      ⇢ UI-9c, UI-34h, UI-35f, FBK-1

      *Done when:* no bulk run leaves anything on the screen that has to be dismissed unless
      something failed, and a person who looked away sees the result in the same place every time.

- [ ] **UI-47** · 🧪 **Acting on one thing says it worked.** A recording sent to the trash from its
      page raises "*title* sent to the trash" with *Undo*, on the library it goes back to; *Undo*
      restores it and says so. A recording moved raises "Moved to *library*", with no *Undo*, for
      the section's reason. A library sent to the trash, from its card or from its settings, raises
      "*name* sent to the trash" with *Undo*, which restores the library. A failure of any of
      these, *Undo* included, raises the API's own `detail`, as `FBK-1` does for a failed mutation.

      🧪 Each of the three raises its toast once; *Undo* after a recording's trash and after a
      library's restores it and refreshes the views that lost it; a refused restore says so.
      Exercised in a browser. ⇢ UI-46

      *Done when:* none of the three ends in silence, and the two that can be undone can be undone
      from where somebody lands.

- [ ] **UI-48** · 🧪 **Restoring from the trash says where it went.** Restoring a recording or a
      library from V9 removes its row and says nothing else. It raises a `done` toast naming the
      library it went back to, or the library itself, and a library restored with its recordings
      says how many. Not *Undo*: the way back is the trash it just left, one click away in the
      sidebar. Scoped after `INT-8`, which rewrites the trash view's rows and data and already
      raises a toast for what an emptying destroyed — so the two land in one voice.

      🧪 Restoring a recording and a library each raises one toast naming where it went.
      ⇢ UI-46, INT-8

      *Done when:* nothing leaves the trash without the screen saying where it went.
