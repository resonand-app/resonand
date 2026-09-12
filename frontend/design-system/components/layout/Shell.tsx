import type { ReactNode } from 'react';

export interface ShellProps {
  /** The top bar. `TopNav`, always. */
  nav: ReactNode;
  /** The left bar. `Sidebar`, which decides its own width from `collapsed`. */
  sidebar: ReactNode;
  /** The view. Scrolls on its own; the chrome around it does not move. */
  children: ReactNode;
  /**
   * The persistent player.
   *
   * **Absent rather than empty when nothing is playing** -- pass `undefined`, not a `PlayerBar`
   * with no title. A 64px bar with nothing in it is a control somebody keeps looking at to work
   * out what it is for.
   */
  player?: ReactNode;
  /**
   * The upload tray, over the view at the bottom right, above the player. `UI-35i`.
   *
   * **Out of the flow, like the toasts.** It reports on a batch somebody carries on working
   * through, so it floats over the corner of the view rather than taking a band of the frame the
   * whole page has to reflow around.
   */
  tray?: ReactNode;
  /**
   * Whether the player is drawing anything, which `player` cannot answer.
   *
   * The frame is handed a player on every screen and the bar decides for itself whether it has a
   * recording to show, so the presence of the prop says nothing about the height of the thing the
   * tray has to clear. `ToastRegion` takes the same boolean for the same reason.
   */
  playerVisible?: boolean;
}

/**
 * The desktop frame: nav, sidebar, content, player, all floating in a 12px gap (`UI-35a`).
 *
 * The one piece of layout in the system, and the reason it is a component rather than a page's
 * business: every view is drawn inside it, and a view that laid out its own chrome would be a
 * view that gets the gap wrong. Nav 52, sidebar 224 (52 collapsed), player 64, `--panel-gap`
 * between them and around them -- all from tokens, so `UI-4c`'s breakpoints change the numbers in
 * one file rather than in eight.
 *
 * **Nothing here scrolls except the content, and that only downwards.** The nav, the sidebar and
 * the player are fixed furniture; the view moves underneath them. That is what makes the player
 * persistent in the sense that matters -- it survives every navigation because it is never inside
 * the thing that navigates.
 *
 * The phone shell is not this component (`DEC-23`). Below `--breakpoint-phone` the desktop frame
 * is replaced rather than narrowed: four bottom tabs, a docked player strip, and sheets instead of
 * panels. `UI-4f` builds it, from §2.3's prose.
 */
export function Shell({ nav, sidebar, children, player, tray, playerVisible = false }: ShellProps) {
  return (
    <div
      data-ds="shell"
      style={{
        // `dvh` and not `vh`, the same unit the phone shell uses: on a mobile browser `100vh` is
        // the viewport with the address bar retracted, which is taller than the viewport you are
        // actually looking at, and the frame that must never scroll would scroll by the height of
        // the chrome. The `--panel-gap` padding stays inside it -- `base.css` makes the box a
        // border-box, so this is the height of the screen rather than the height plus the gaps.
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--panel-gap)',
        padding: 'var(--panel-gap)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {nav}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 'var(--panel-gap)' }}>
        {sidebar}
        {/* The only thing on the page that scrolls. `minWidth: 0` because a grid of cards inside
            a flex child will otherwise push the sidebar off the screen rather than wrap. */}
        {/* `clip` on the cross axis rather than `auto`: every view here is built to fit the width
            it is given -- the columns collapse, the grids reflow, and every flex child carries
            `minWidth: 0` -- so a horizontal scrollbar is never the answer to anything, it is a
            layout bug offering to hide itself. `clip` pairs with `auto` without turning the
            vertical scroll into two scrollbars, which `hidden` would. */}
        <main
          data-ds="shell-content"
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            overflowX: 'clip',
            position: 'relative',
          }}
        >
          {/* The gutter is on a box inside the scrollport, not on `<main>`: a sticky offset is
              measured from the scroll container's padding box, so padding `<main>` would pin the
              dense list's header 28px down and leave a band for rows to scroll through. */}
          {/* `components.css` makes this a column for a view whose root carries `data-fills`, so
              a view that fits the screen can ask without every other view losing its page. */}
          <div data-ds="shell-page" style={{ padding: 'var(--page-padding)' }}>
            {children}
          </div>
        </main>
      </div>
      {tray !== undefined && (
        <div
          data-ds="shell-tray"
          style={{
            position: 'fixed',
            right: 'var(--panel-gap)',
            bottom: playerVisible
              ? 'calc(var(--player-height) + var(--panel-gap) * 2)'
              : 'var(--panel-gap)',
            // A width and not a max-width: a fixed box with neither is shrink-to-fit, and the
            // tray asking for `100%` of it would be asking itself how wide it is.
            width: 'min(var(--tray-width), calc(100% - var(--panel-gap) * 2))',
            zIndex: 'var(--z-tray)',
          }}
        >
          {tray}
        </div>
      )}
      {player}
    </div>
  );
}
