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
  /** The upload tray, docked above the player. `UI-35i`. */
  tray?: ReactNode;
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
 * **Nothing here scrolls except the content.** The nav, the sidebar and the player are fixed
 * furniture; the view moves underneath them. That is what makes the player persistent in the
 * sense that matters -- it survives every navigation because it is never inside the thing that
 * navigates.
 *
 * The phone shell is not this component (`DEC-23`). Below `--breakpoint-phone` the desktop frame
 * is replaced rather than narrowed: four bottom tabs, a docked player strip, and sheets instead of
 * panels. `UI-4f` builds it, from §2.3's prose.
 */
export function Shell({ nav, sidebar, children, player, tray }: ShellProps) {
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
        <main
          data-ds="shell-content"
          style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}
        >
          {children}
        </main>
      </div>
      {tray}
      {player}
    </div>
  );
}
