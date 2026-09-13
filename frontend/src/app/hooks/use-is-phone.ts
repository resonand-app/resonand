/**
 * Whether this is the phone (`UI-4f`, `DEC-23`).
 *
 * Below `--breakpoint-phone` the desktop frame is **replaced**, not narrowed: four bottom tabs, a
 * docked player strip, sheets instead of panels. So this is a question the shell asks once and
 * answers by rendering one component or the other, rather than a set of media queries that make
 * a desktop layout smaller until it is unusable one-handed.
 */

import { useSyncExternalStore } from 'react';

/** Where the desktop shell stops. `--breakpoint-phone`, which this has to know as a number. */
export const PHONE_BREAKPOINT = 720;

export function useIsPhone(): boolean {
  return useSyncExternalStore(watch, isPhone, () => false);
}

function isPhone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < PHONE_BREAKPOINT;
}

/** `matchMedia` where it exists, a resize listener where it does not (jsdom, without a stub). */
function watch(onChange: () => void): () => void {
  if (typeof window.matchMedia === 'function') {
    const media = window.matchMedia(`(max-width: ${String(PHONE_BREAKPOINT - 1)}px)`);
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
