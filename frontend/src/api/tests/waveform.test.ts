/**
 * The one endpoint that does not answer JSON (`UI-31b`, `ING-5`).
 *
 * The version byte is the subject. A blob in a format this build does not know, read as though it
 * were the one it does, draws a plausible picture of the wrong recording -- and nobody reports
 * that, because it looks like a waveform. So the refusal is tested before the decoding is.
 */

import { describe, expect, it } from 'vitest';

import { decodeWaveform } from '../waveform';

/** A blob in the stored form: version, duration, count, then int8 pairs. */
function encode(version: number, durationMs: number, pairs: [number, number][]): ArrayBuffer {
  const buffer = new ArrayBuffer(9 + pairs.length * 2);
  const view = new DataView(buffer);
  view.setUint8(0, version);
  view.setUint32(1, durationMs, true);
  view.setUint32(5, pairs.length, true);
  pairs.forEach(([low, high], index) => {
    view.setInt8(9 + index * 2, low);
    view.setInt8(9 + index * 2 + 1, high);
  });
  return buffer;
}

describe('decoding', () => {
  it('reads the pairs as signed, so a quiet passage stays quiet', () => {
    const { peaks } = decodeWaveform(encode(2, 1000, [[-127, 127]]));
    expect(peaks).toEqual([-1, 1]);
  });

  it('keeps the duration the header carries rather than deriving one', () => {
    // The duration is what survives resampling: 200 pairs of a 48-minute recording still cover
    // 48 minutes, and a rate multiplied out would say twenty seconds.
    expect(decodeWaveform(encode(2, 2_880_000, [[-1, 1]])).durationMs).toBe(2_880_000);
  });

  it('refuses a format it does not know rather than drawing it', () => {
    expect(() => decodeWaveform(encode(3, 1000, [[0, 0]]))).toThrow(/version 3/);
  });

  it('reads version 1, whose rate and count give a duration exactly', () => {
    const buffer = new ArrayBuffer(6 + 4);
    const view = new DataView(buffer);
    view.setUint8(0, 1);
    view.setUint8(1, 10);
    view.setUint32(2, 2, true);
    const { durationMs, peaks } = decodeWaveform(buffer);
    expect(durationMs).toBe(200);
    expect(peaks).toHaveLength(4);
  });

  it('says so when it was handed something that is not a waveform at all', () => {
    expect(() => decodeWaveform(new ArrayBuffer(2))).toThrow(/too short/);
  });

  it('reads what arrived rather than trusting a count a truncated blob claims', () => {
    const buffer = encode(2, 1000, [
      [-100, 100],
      [-50, 50],
    ]);
    const { peaks } = decodeWaveform(buffer.slice(0, 11));
    expect(peaks).toHaveLength(2);
  });
});
