/**
 * Reducing a recording keeps its shape (`UI-2a`).
 *
 * The reduction has to agree with `resonand.media.waveform.resample`, because both run on the
 * same recording: the server reduces on the way out and the client reduces again to the pixels
 * available, and two different roundings would make one recording draw two shapes depending on
 * which end had done more of the work. The bucket boundaries asserted below are that arithmetic.
 */

import { describe, expect, it } from 'vitest';

import { generatePeaks } from './generate-peaks';
import { amplitudeAt, bucketCount, resamplePeaks } from './peaks';

/** The silhouette: one height per bucket, which is all the drawing uses. */
function silhouette(peaks: readonly number[]): number[] {
  return Array.from({ length: bucketCount(peaks) }, (_, i) => amplitudeAt(peaks, i));
}

describe('resamplePeaks', () => {
  it('keeps the loudest moment instead of averaging it away', () => {
    // A shout in a quiet room. Averaging would flatten it into the quiet room.
    const quiet = [-0.02, 0.02, -0.02, 0.02, -0.9, 0.95, -0.02, 0.02];
    expect(resamplePeaks(quiet, 2)).toEqual([-0.02, 0.02, -0.9, 0.95]);
  });

  it('takes the lowest low and the highest high of each bucket', () => {
    const peaks = [-0.1, 0.2, -0.5, 0.3, -0.2, 0.9, -0.4, 0.1];
    expect(resamplePeaks(peaks, 2)).toEqual([-0.5, 0.3, -0.4, 0.9]);
  });

  it('never invents detail it was not given', () => {
    // Asking for more buckets than exist returns what exists. A drawing that shows more than was
    // measured is the thing the format's version byte exists to prevent by accident.
    const peaks = [-0.5, 0.5, -0.25, 0.25];
    expect(resamplePeaks(peaks, 400)).toBe(peaks);
    expect(bucketCount(resamplePeaks(peaks, 400))).toBe(2);
  });

  it('reduces to exactly the number of buckets asked for', () => {
    const peaks = generatePeaks(7, 2837);
    for (const buckets of [1, 6, 29, 88, 400, 2836]) {
      expect(bucketCount(resamplePeaks(peaks, buckets))).toBe(buckets);
    }
  });

  it('draws the whole recording and not the beginning of it', () => {
    // The defect this replaces was `peaks.slice(0, count)`. A recording that is silent for its
    // first half and loud for its second reduced to two buckets: truncation says both are silent.
    const half = 200;
    const peaks = [
      ...new Array<number>(half * 2).fill(0),
      ...Array.from({ length: half * 2 }, (_, i) => (i % 2 === 0 ? -0.9 : 0.9)),
    ];
    expect(silhouette(resamplePeaks(peaks, 2))).toEqual([0, 0.9]);
    // What truncation would have said, for the contrast:
    expect(silhouette(peaks.slice(0, 4))).toEqual([0, 0]);
  });

  it('is the same shape whichever end did the reducing', () => {
    // The server may have already reduced to 400 before the client reduces to 100. Where the
    // buckets divide evenly, the answer must not depend on that.
    const peaks = generatePeaks(3, 1600);
    expect(resamplePeaks(resamplePeaks(peaks, 400), 100)).toEqual(resamplePeaks(peaks, 100));
  });
});

describe('amplitudeAt', () => {
  it('takes the larger excursion in either direction', () => {
    expect(amplitudeAt([-0.8, 0.2], 0)).toBeCloseTo(0.8);
    expect(amplitudeAt([-0.2, 0.8], 0)).toBeCloseTo(0.8);
  });

  it('reads zero past the end rather than NaN', () => {
    expect(amplitudeAt([], 0)).toBe(0);
    expect(amplitudeAt([-0.5, 0.5], 9)).toBe(0);
  });
});
