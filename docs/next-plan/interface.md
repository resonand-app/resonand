# The interface, after the first version

`UI-*` — views and the design system under them, for what the first version did not build. Its
record is [`docs/v0.1.0-plan/interface.md`](../v0.1.0-plan/interface.md), and the numbering
continues from it: an identifier is never reused, whichever folder minted it.

Anything visual is verified in a browser, not only in jsdom, and every string lives in
`src/i18n/en/`.

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

- [ ] **UI-46a** · 🧪 **A trash run that partly failed can still be undone.** Out of `UI-46`,
      found at the `0.2.0` hand-over. A toast carries one action, and a trash run where some
      recordings failed spends it on *Retry N*, so the ones that did go to the trash cannot be
      brought back from where the run ended — they have to be found in the trash. The section's
      rule is that a trash which moved anything carries *Undo*, and the partial run is the one
      where somebody most wants to look again before going on.

      Two shapes, and the entry does not pick: the toast store carries a second action, so the
      failed toast offers *Retry N* and *Undo* side by side; or *Undo* stays the toast's one
      action and the failures stay what they already are — selected, on screen — with *Retry*
      on the bulk bar. The first keeps both answers in one place; the second keeps the rule of
      one action per toast that `UI-46` set.

      🧪 A trash run where some fail can be undone for the ones that went, and the undo restores
      those alone. ⇢ UI-46

      *Done when:* every trash run that moved anything can be undone from where it ended.

- [ ] **UI-47a** · 🧪 **A test notices when *Undo* stops refreshing the views.** Out of `UI-47`,
      found at the `0.2.0` hand-over. *Undo* after a recording's trash and after a library's both
      invalidate what lost it, but `RecordingActions.test.tsx` and `TrashLibrary.test.tsx` assert
      only the toast and the restored row, so removing either invalidation passes the suite. The
      test makes the listing that lost the recording, and the libraries view that lost the
      library, show it again after *Undo* — the refresh observed where somebody would see it,
      rather than a spy on the query client. ⇢ UI-47

      *Done when:* removing the invalidation in `RecordingActions.tsx` or `TrashLibraryDialog.tsx`
      fails a test.

- [ ] **UI-48** · 🧪 **Restoring from the trash says where it went.** Restoring a recording or a
      library from V9 removes its row and says nothing else. It raises a `done` toast naming the
      library it went back to, or the library itself, and a library restored with its recordings
      says how many. Not *Undo*: the way back is the trash it just left, one click away in the
      sidebar. Scoped after `INT-8`, which rewrites the trash view's rows and data and already
      raises a toast for what an emptying destroyed — so the two land in one voice.

      🧪 Restoring a recording and a library each raises one toast naming where it went.
      ⇢ UI-46, INT-8

      *Done when:* nothing leaves the trash without the screen saying where it went.
