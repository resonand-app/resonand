/**
 * A clock that re-renders, for text that says how long ago something was (`FBK-6`).
 *
 * **The reason this is needed is not obvious and is worth stating.** A relative time is computed
 * at render, so it is only ever as current as the last render -- and the transcription card had no
 * reason to render again. Its poll runs every ten seconds, but TanStack Query notifies a component
 * only about the fields it actually read, and structural sharing means an unchanged response is
 * the same object: a job that is still running answers the same four fields every time, so nothing
 * changed, so nothing re-rendered. "Started 4 seconds ago" stayed on screen for the whole
 * transcription. A clock that depends on a network response to advance is not a clock.
 *
 * **The interval is not the granularity.** The text is written to the minute, and this ticks twice
 * a minute so the moment it changes lands within thirty seconds of being true rather than up to a
 * minute late. Two re-renders a minute of one card is nothing, and the string only changes once a
 * minute, so nothing on screen flickers at the tick.
 *
 * Only mount it where something is actually elapsing. A hook that ran on a settled screen would be
 * a timer per card on a page of forty.
 */

import { useEffect, useState } from 'react';

/** How often a minute-granularity label re-checks the time. */
export const MINUTE_TICK_MS = 30_000;

/**
 * The current time in milliseconds, refreshed every `every` milliseconds.
 *
 * The first value is taken at mount rather than at module load, so a card opened an hour after the
 * tab was does not start an hour behind.
 */
export function useNow(every: number = MINUTE_TICK_MS): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, every);
    return () => {
      clearInterval(timer);
    };
  }, [every]);

  return now;
}
