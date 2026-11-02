# Infrastructure, after the first version

`INF-*` here, rather than in [`docs/v0.1.0-plan/infrastructure.md`](../v0.1.0-plan/infrastructure.md),
which is a record now. The numbering continues from it: an identifier is never reused, whichever
folder it was minted in.

## What the tests assume about a browser

- [ ] **INF-26** · **The virtualised tests get their viewport from one place.** jsdom performs no
      layout, so a test that draws the dense list or the transcript has to tell the virtualiser
      how tall things are, or it draws no rows and every row-level assertion passes on nothing.
      That fake is written out by hand six times: once at module level in
      `src/test/support/views.tsx`, and as a `measured()` helper or inline spies in
      `RecordingList`, `Transcript`, `came-from`, `across-libraries` and `marking`.

      Six copies cost one weekly update. `@tanstack/virtual-core` 3.19.6 moved the scroll
      container's measurement from `offsetHeight` to `clientHeight`, and the frontend group stayed
      red from 2026-10-20: #70 taught four of the copies the new property, and the two written on
      favourites branches at the same time still faked the old one, which took #83 to find. The
      next change to what the virtualiser reads will meet the same six copies, or seven.

      **One helper in `src/test/support/`**, giving the virtualiser a viewport: the
      `ResizeObserver` stub and both heights, `clientHeight` for the scroll container and
      `offsetHeight` for the rows. `views.tsx` and every virtualised test call it, and a guard in
      the shape of `token-adherence.node.test.ts` refuses a test file that spies on
      `HTMLElement.prototype`'s heights by hand. Fakes of a measurement a component takes for
      itself are not the virtualiser's and stay where they are: `use-waveform-fade` measures its
      panel, and `Transcript`'s `scrollable()` gives `use-follow` a scroller to move.

      *Rejected:* one fake for every test, in `setup.ts`. It would put every component test in a
      720-pixel world, where a component that measures zero and draws nothing passes; `views.tsx`
      reaches only the files that mount a view for that reason, and the helper keeps the choice
      with the test.

      *Done when:* no test file fakes the virtualiser's heights except through the helper, and a
      new one that does fails the guard.
