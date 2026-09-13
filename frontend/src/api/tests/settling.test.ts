/**
 * When a view asks again, and when it stops (`FBK-3`).
 *
 * The two properties worth a test are the two that cost something if they are wrong: a list that
 * never asks leaves a card saying `--:--` forever, and a list that never stops asking turns one
 * failed probe into a request every three seconds for as long as the tab is open.
 */

import { describe, expect, it } from 'vitest';

import {
  RUNNING_POLL_MS,
  SETTLING_POLL_MS,
  WATCH_FOR_MS,
  intervalFor,
  intervalForOne,
} from '../settling';
import type { Settling } from '../settling';

const NOW = Date.parse('2026-09-12T08:00:00.000Z');

function recording(fields: Partial<Settling> = {}): Settling {
  return {
    created_at: new Date(NOW - 1_000).toISOString(),
    duration_ms: 600_000,
    has_waveform: true,
    transcription_state: 'none',
    ...fields,
  };
}

describe('a recording that is still being made', () => {
  it('asks nothing of an archive at rest', () => {
    expect(intervalFor([recording(), recording()], NOW)).toBe(false);
  });

  it('asks quickly while a recording that has just arrived has no duration', () => {
    expect(intervalFor([recording({ duration_ms: null })], NOW)).toBe(SETTLING_POLL_MS);
  });

  it('asks quickly while it has no waveform', () => {
    expect(intervalFor([recording({ has_waveform: false })], NOW)).toBe(SETTLING_POLL_MS);
  });

  it('takes its pace from the fastest thing anybody is waiting for', () => {
    // One row still being probed is the whole list being out of date, whatever else is on it.
    const rows = [
      recording({ transcription_state: 'running' }),
      recording({ has_waveform: false }),
    ];
    expect(intervalFor(rows, NOW)).toBe(SETTLING_POLL_MS);
  });

  it('watches a running transcription at the pace of a badge, not of a probe', () => {
    // Minutes or hours of somebody else's queue. Half a minute is close enough for a badge, and
    // three seconds would be a request every three seconds for an hour.
    expect(intervalFor([recording({ transcription_state: 'running' })], NOW)).toBe(RUNNING_POLL_MS);
  });
});

describe('when it stops asking', () => {
  it('gives up on a derivative that has not arrived in a quarter of an hour', () => {
    // A probe that failed leaves `duration_ms` null forever. Age is what stops this becoming a
    // permanent poll; the queue in Administration is where a failure that old is answered.
    const old = recording({
      duration_ms: null,
      created_at: new Date(NOW - WATCH_FOR_MS - 1).toISOString(),
    });
    expect(intervalFor([old], NOW)).toBe(false);
  });

  it('keeps watching one that arrived just inside the window', () => {
    const recent = recording({
      has_waveform: false,
      created_at: new Date(NOW - WATCH_FOR_MS + 1_000).toISOString(),
    });
    expect(intervalFor([recent], NOW)).toBe(SETTLING_POLL_MS);
  });

  it('stops rather than polls when it cannot tell how old a recording is', () => {
    const undated = recording({ duration_ms: null, created_at: 'not a date' });
    expect(intervalFor([undated], NOW)).toBe(false);
  });

  it('asks nothing about a recording it does not have yet', () => {
    expect(intervalForOne(undefined, NOW)).toBe(false);
  });

  it('answers for one recording the way it answers for a list of one', () => {
    const one = recording({ duration_ms: null });
    expect(intervalForOne(one, NOW)).toBe(intervalFor([one], NOW));
  });
});
