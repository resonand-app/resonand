/**
 * The arithmetic that keeps a playhead moving between two reports.
 *
 * Four properties, and the one that matters most is the last: a prediction that could run past
 * the end would draw a position the recording does not have, and the correction when the next
 * report arrived would be the playhead jumping backwards.
 */

import { describe, expect, it } from 'vitest';

import { held, predicted } from './follow';

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

describe('held', () => {
  it('keeps the drawing where it is when a report lands a hair behind it', () => {
    // A tenth of the recording a second, and a report 40ms stale: the drawing is right and the
    // report is the one that is late.
    expect(held(0.504, 0.5, 0.1)).toBe(0.504);
  });

  it('follows a report that is ahead of the drawing', () => {
    expect(held(0.5, 0.52, 0.1)).toBe(0.52);
  });

  it('snaps to the report when the drawing has run away from it', () => {
    // The failure this exists for: a resume carried the position forward from an anchor that
    // stopped being true during the pause, so the drawing sat four tenths of the recording past
    // the sound. Holding that is holding a wrong answer for as long as playback lasts.
    expect(held(0.8, 0.4, 0.1)).toBe(0.4);
  });

  it('holds nothing at all when nothing is playing', () => {
    // Standing still, the report is the only thing that knows anything, so it always wins --
    // which is what makes the drawing exact the moment a pause freezes it.
    expect(held(0.504, 0.5, 0)).toBe(0.5);
  });

  it('goes back when the recording does', () => {
    expect(held(0.9, 0.1, 0.1)).toBe(0.1);
  });
});
