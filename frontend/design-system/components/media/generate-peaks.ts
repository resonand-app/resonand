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

/** A small linear congruential generator. Seeded, repeatable, and not remotely cryptographic. */
function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * `count` amplitudes in 0-1, wandering the way speech does.
 *
 * The envelope drifts rather than jumping, because real speech has phrases; one bar in fourteen
 * is knocked down to near silence, which is what gives a transcript-shaped recording its gaps.
 */
export function generatePeaks(seed: number, count: number): number[] {
  const random = prng(seed);
  const out: number[] = [];
  let envelope = 0.55;
  for (let i = 0; i < count; i++) {
    envelope += (random() - 0.5) * 0.42;
    envelope = Math.max(0.1, Math.min(1, envelope));
    let amplitude = envelope * (0.4 + 0.6 * random());
    if (random() < 0.07) amplitude *= 0.16;
    out.push(amplitude);
  }
  return out;
}
