/**
 * Whether the window is narrower than `px`.
 *
 * The shell asks two fixed versions of this question -- `useIsPhone` and `useSidebarCollapse` --
 * and answers both this way. This is the one a component asks about its own row: a bar that holds
 * five controls beside a count fits at 1280 and does not at 380, and the threshold belongs to the
 * bar rather than to the layout.
 *
 * Read through `useSyncExternalStore` rather than into state in an effect: the window is an
 * external source of truth, and mirroring it into state is how a render and a resize end up
 * disagreeing for one frame.
 */

import { useCallback, useSyncExternalStore } from 'react';

export function useNarrowerThan(px: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // `matchMedia` where it exists, a resize listener where it does not (jsdom, without a
      // stub). An environment that cannot answer has to render the interface, not throw.
      if (typeof window.matchMedia === 'function') {
        const media = window.matchMedia(`(max-width: ${String(px - 1)}px)`);
        media.addEventListener('change', onChange);
        return () => {
          media.removeEventListener('change', onChange);
        };
      }
      window.addEventListener('resize', onChange);
      return () => {
        window.removeEventListener('resize', onChange);
      };
    },
    [px],
  );
  const read = useCallback(
    () => (typeof window === 'undefined' ? false : window.innerWidth < px),
    [px],
  );
  return useSyncExternalStore(subscribe, read, () => false);
}
