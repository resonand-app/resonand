/**
 * When the sidebar is out and when it is not (`UI-4c`, §2.2).
 *
 * Two things decide it, and the order matters. The window collapses it below 1180 -- **before**
 * the card grid drops to two columns at 900, because three 320px cards fit at 1280 only with the
 * sidebar out of the way. And a person can toggle it themselves at any width, which wins until
 * the window crosses the threshold again.
 *
 * The preference is remembered, because a sidebar that comes back every time it is dismissed is a
 * control somebody dismisses every time.
 */

import { useCallback, useState, useSyncExternalStore } from 'react';

/** Where the sidebar folds. `--breakpoint-sidebar`, which this has to know as a number. */
export const SIDEBAR_BREAKPOINT = 1180;

const REMEMBERED = 'sonarium.sidebar-collapsed';

export interface SidebarCollapse {
  collapsed: boolean;
  toggle: () => void;
}

export function useSidebarCollapse(): SidebarCollapse {
  const [chosen, setChosen] = useState<boolean | null>(remembered);
  // The width is read through `useSyncExternalStore` rather than into state in an effect: the
  // window is an external source of truth, and mirroring it into state is how a render and a
  // resize end up disagreeing for one frame.
  const narrow = useSyncExternalStore(watchWidth, isNarrow, () => false);

  // Crossing the threshold is the window's decision and it overrules the last manual one:
  // otherwise a sidebar dismissed at 1400 stays dismissed at 1920, where it fits. Adjusted during
  // render rather than in an effect, which is React's own answer for state that has to follow a
  // value -- an effect would render the stale answer once first.
  const [wasNarrow, setWasNarrow] = useState(narrow);
  if (wasNarrow !== narrow) {
    setWasNarrow(narrow);
    setChosen(null);
  }

  const collapsed = chosen ?? narrow;
  const toggle = useCallback(() => {
    setChosen((current) => {
      const next = !(current ?? isNarrow());
      remember(next);
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

function isNarrow(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < SIDEBAR_BREAKPOINT;
}

/**
 * Watch the width.
 *
 * `matchMedia` where it exists, and a resize listener where it does not -- jsdom without a stub
 * is the second case, and an environment that cannot answer has to render the interface rather
 * than throw. The same rule the system's reduced-motion hook follows.
 */
function watchWidth(onChange: () => void): () => void {
  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia(`(max-width: ${String(SIDEBAR_BREAKPOINT - 1)}px)`);
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }
  window.addEventListener('resize', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
  };
}

function remembered(): boolean | null {
  try {
    const stored = window.localStorage.getItem(REMEMBERED);
    return stored === null ? null : stored === 'true';
  } catch {
    // A browser that refuses storage is a browser that gets the width's answer, not an error.
    return null;
  }
}

function remember(collapsed: boolean): void {
  try {
    window.localStorage.setItem(REMEMBERED, String(collapsed));
  } catch {
    // Nothing to do about it, and nothing worth telling anybody.
  }
}
