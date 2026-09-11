/**
 * The arithmetic that keeps a playhead moving between two reports.
 *
 * Four properties, and the one that matters most is the last: a prediction that could run past
 * the end would draw a position the recording does not have, and the correction when the next
 * report arrived would be the playhead jumping backwards.
 */

import { describe, expect, it } from 'vitest';

import { predicted } from './follow';

describe('predicted', () => {
  it('is where the report put it at the moment of the report', () => {
    expect(predicted(0.25, 0, 0.1)).toBe(0.25);
  });

  it('carries the position forward at the rate it is moving', () => {
    // A 10-second recording covers a tenth of itself a second, so a quarter second is 2.5%.
    expect(predicted(0.5, 0.25, 0.1)).toBeCloseTo(0.525, 5);
  });

  it('does not move at all when nothing is playing', () => {
    expect(predicted(0.5, 10, 0)).toBe(0.5);
  });

  it('never runs past either end of the recording', () => {
    // Prediction outruns the reports near the end, and a drawing that went past 1 would come
    // back when the next report arrived -- a playhead that jumps backwards.
    expect(predicted(0.99, 5, 0.1)).toBe(1);
    expect(predicted(0.01, 5, -0.1)).toBe(0);
  });
});
