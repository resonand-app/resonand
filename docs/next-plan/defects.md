# Defects found in use, after the first version

`BUG-*` here, rather than in [`docs/v0.1.0-plan/defects.md`](../v0.1.0-plan/defects.md), which is a
record now. The numbering continues from it: an identifier is never reused, whichever folder it was
minted in. The bar is the same as there — a defect gets a number when it is worth citing later.

---

- [ ] **BUG-4** · **A recording sometimes opens with its transcript missing.** The heading says
      *14 segments* and no line is drawn under it, and nothing brings them back: not waiting, not
      playing, not the next line becoming active. Scrolling the column by a single pixel draws all
      fourteen at once. Somebody who opens a recording and sees an empty transcript has no reason to
      try that, and reads it as a recording whose transcript is gone.

      It was found by a scripted browser rather than by a person, which is also how it was
      measured: headless Chrome 144 at 1440×900, the full demo archive, *Grandma's childhood
      school* opened from its library card. One load in five or six came up blank and stayed blank
      for thirty seconds; every other one drew its lines within a second. The data was never the
      problem — the transcript request had answered `200`, the count in the heading came from it,
      and the lines were there to draw. It has not yet been reproduced in a headed browser, and
      that is the first thing to establish, because a race that only a headless one hits is still
      worth fixing but is a different fix.

      The suspicion is the virtualiser, not the data. On the desktop the transcript opens no
      scrollport of its own (`UI-11g`): it is handed the column's, and told through `scrollMargin`
      how far down it the lines begin, measured in a layout effect after the first render. A
      virtualiser that first reads a scroll element it cannot yet measure — or reads the column
      before the panel above it has its height — computes an empty range, and recomputes on a
      resize or a scroll of that element. When neither happens after the first reading, nothing
      asks again; a pixel of scroll is exactly what asks.

      A scripted screenshot run had already lost its transcript this way and put it down to a slow
      slot, waiting longer instead. Waiting was never going to help, which is worth knowing about
      the next report that sounds like slowness.

      *Done when:* a recording's lines are drawn on every load without anybody scrolling — a
      hundred consecutive cold loads in a real browser, headed and headless, none of them blank —
      and the fix says in the code which ordering it guards. 🧪 *A test that reproduces that
      ordering — the column measured before it has a size, and no scroll after it — and fails on
      the current `Transcript.tsx`.*
