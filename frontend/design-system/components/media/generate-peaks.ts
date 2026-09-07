/**
 * Plausible peaks for a specimen (`UI-1f`).
 *
 * **Not for production, and the separation is the point.** In the product, peaks are computed
 * once on ingest and stored, so a recording draws the same shape in a row, on a card and in the
 * detail view. Until that job has run there is no waveform -- a dashed rule and a duration, never
 * an invented shape -- which is exactly what this function invents. It exists so a specimen board
 * and a test have something with the right texture to draw.
 *
 * Its own module rather than a second export from `Waveform`, so that a file importing it is a
 * file visibly reaching for mock data.
 *
 * Deterministic on `seed`: the same seed is the same recording every time, and a specimen that
 * reshuffled itself on every render would be a specimen of nothing.
 */

import type { Peaks } from './peaks';

/** A small linear congruential generator. Seeded, repeatable, and not remotely cryptographic. */
function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * `count` min/max pairs, wandering the way speech does.
 *
 * The envelope drifts rather than jumping, because real speech has phrases; one bucket in
 * fourteen is knocked down to near silence, which is what gives a transcript-shaped recording its
 * gaps. The two halves of each pair differ slightly, because a voice is not symmetric -- and a
 * generator that produced perfect mirrors would make `amplitudeAt` look correct whichever half it
 * read.
 */
export function generatePeaks(seed: number, count: number): Peaks {
  const random = prng(seed);
  const out: number[] = new Array<number>(count * 2);
  let envelope = 0.55;
  for (let i = 0; i < count; i++) {
    envelope += (random() - 0.5) * 0.42;
    envelope = Math.max(0.1, Math.min(1, envelope));
    let amplitude = envelope * (0.4 + 0.6 * random());
    if (random() < 0.07) amplitude *= 0.16;
    out[i * 2] = -amplitude * (0.82 + 0.18 * random());
    out[i * 2 + 1] = amplitude;
  }
  return out;
}
