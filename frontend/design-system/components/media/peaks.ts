/**
 * A recording's shape, and how to reduce it to the space it is drawn in (`UI-2a`).
 *
 * **Interleaved minimum and maximum, one pair per bucket, each in -1…1.** That is the shape the
 * API serves: `GET /audio/{uuid}/waveform` returns `int8` min/max pairs behind a version byte
 * (`ING-5`, `ING-14`), and holding the same shape here means the reduction below can be the same
 * reduction the server does, rather than an approximation of it.
 *
 * A pair rather than a single amplitude, because that is what was measured. The drawing is
 * currently symmetric about the midline and collapses each pair with `amplitudeAt`, but the
 * asymmetry is what makes speech look like speech, and a component that threw it away at the prop
 * boundary could never be given it back without changing every caller.
 */

/** Interleaved `min, max, min, max, …`, each in -1…1. Two numbers per bucket. */
export type Peaks = readonly number[];

/** How many buckets a peaks array holds. */
export function bucketCount(peaks: Peaks): number {
  return Math.floor(peaks.length / 2);
}

/**
 * How tall to draw one bucket, in 0…1.
 *
 * The larger excursion in either direction. Not `(max - min) / 2`, which would draw a bar of
 * average height through a passage that is loud in one direction only -- a plosive, a chair
 * scraping -- and lose exactly the transient the min/max format exists to keep.
 */
export function amplitudeAt(peaks: Peaks, index: number): number {
  const low = peaks[index * 2] ?? 0;
  const high = peaks[index * 2 + 1] ?? 0;
  return Math.min(1, Math.max(Math.abs(low), Math.abs(high)));
}

/**
 * Reduce to `buckets` pairs, keeping the shape (`UI-2a`).
 *
 * **This is what `peaks.slice(0, count)` used to do instead**, which drew the first N buckets and
 * called it the recording -- so a 48-minute interview in a 20px row was the first forty seconds of
 * it, and the system's promise that a recording draws the same shape everywhere was false in the
 * two places it is drawn smallest.
 *
 * A bucket takes the lowest low and the highest high of the pairs it covers. Averaging would
 * flatten a shout in a quiet room into the quiet room. The bucket boundaries are
 * `index * total / buckets`, floored, which is deliberately the same arithmetic as
 * `sonarium.media.waveform.resample` -- the server reduces on the way out and the client reduces
 * again to the pixels available, and two different roundings would make the same recording draw
 * two different shapes depending on which one had done more of the work.
 *
 * **Asking for more buckets than there are returns what there is.** Interpolating up would invent
 * detail the recording never had.
 */
export function resamplePeaks(peaks: Peaks, buckets: number): Peaks {
  const total = bucketCount(peaks);
  if (buckets < 1 || total <= buckets) return peaks;

  const reduced: number[] = new Array<number>(buckets * 2);
  for (let index = 0; index < buckets; index++) {
    const start = Math.floor((index * total) / buckets);
    const end = Math.max(start + 1, Math.floor(((index + 1) * total) / buckets));
    let low = Infinity;
    let high = -Infinity;
    for (let bucket = start; bucket < end; bucket++) {
      low = Math.min(low, peaks[bucket * 2] ?? 0);
      high = Math.max(high, peaks[bucket * 2 + 1] ?? 0);
    }
    reduced[index * 2] = low;
    reduced[index * 2 + 1] = high;
  }
  return reduced;
}
