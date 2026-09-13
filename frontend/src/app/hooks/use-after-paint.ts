/**
 * Work that waits for the page to be on screen (`UI-31b`).
 *
 * A frame and not merely an effect. An effect runs before the browser has painted, so gating on
 * one would start eighty requests in the same tick as the layout they are meant to come after --
 * which is exactly what §V2 asks the landing page not to do with its per-card waveforms, and what
 * V3's card grid would otherwise do with its own.
 *
 * One flag for a whole grid rather than one per card: they mount together, and a state update per
 * card would be one render of the grid per card.
 */

import { useEffect, useState } from 'react';

export function useAfterPaint(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setPainted(true);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);
  return painted;
}
