# Defects found in use, after the first version

`BUG-*` here, rather than in [`docs/v0.1.0-plan/defects.md`](../v0.1.0-plan/defects.md), which is a
record now. The numbering continues from it: an identifier is never reused, whichever folder it was
minted in. The bar is the same as there — a defect gets a number when it is worth citing later.

---

- [x] **BUG-4** · **A recording sometimes opens with its transcript missing.** The heading says
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

      It was established in a headed browser first, on the old code and the same archive: headed
      Chrome came up blank on 8 loads of 30 and headless on 6 of 30. It is not a headless race.

      The suspicion had the virtualiser right and the ordering wrong. The column was never read
      before it had a size — it was read before it existed, as far as the virtualiser could tell.
      The scroller is a ref that `RecordingView` owns, and React attaches an element's ref only
      after the layout effects of everything inside it have run in the same commit.
      `RecordingView` shows a loading state until the recording itself arrives; when the
      transcript request had answered first, the column and the transcript mounted in one commit,
      and the virtualiser's layout effect asked for its scroll element and got `null`. It looks
      again only when `Transcript` renders again. Most loads were rescued by something unrelated —
      a later query changing a prop — and a scroll releases following, which is a state change,
      which is a render: that is the pixel. Which request answered last decided it, and the
      transcript, the larger response, usually lost.

      A passive effect in `Transcript` now compares the virtualiser's scroll element with the
      column's ref — by the time passive effects run, the ref is attached — and renders once more
      when they differ. On the phone, where the transcript owns its scroller, they never differ
      and nothing extra happens. Holding the scroller in state in `RecordingView` through a
      callback ref is the textbook answer and was rejected: the player, the waveform fade and the
      follow hook take the same ref and read it in passive effects, where it is always attached,
      and their contract would change to serve one consumer's layout-phase read. Walking up from
      the list to find the scroller was rejected too — the element exists before its ref does,
      but a selector for another component's markup is a coupling nobody would see break. The
      cost is that, in the ordering that used to go blank, the lines arrive one frame after the
      heading rather than with it.

      With the fix: 100 cold loads from the library card headed, 100 headless, and 100 headless by
      direct address, none blank; heading to first line at a median of 238 to 358 ms, 973 ms at
      worst. 🧪 *`src/features/recording/tests/Transcript.test.tsx` opens the recording twice on
      one cache with nothing going stale, so the second mount puts the column and the transcript
      in one commit and nothing renders them again — the heading is there and, on the old code, no
      line is. The criterion above names the ordering that was suspected; the test reproduces the
      one that was found.*
