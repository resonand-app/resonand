/**
 * The clock that makes an elapsed time elapse (`FBK-6`).
 *
 * Worth a test for the reason it exists: a relative time is computed at render, and the card it is
 * on had no reason to render again. "Started 4 seconds ago" stayed on screen for a whole
 * transcription, and nothing in the code looked wrong.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MINUTE_TICK_MS, useNow } from '@/app/hooks/use-now';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a clock that re-renders', () => {
  it('moves on its own, without anything else having changed', () => {
    const { result } = renderHook(() => useNow());
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(MINUTE_TICK_MS);
    });
    expect(result.current).toBeGreaterThanOrEqual(first + MINUTE_TICK_MS);
  });

  it('checks twice a minute, so a label written to the minute is never a minute late', () => {
    const { result } = renderHook(() => useNow());
    const first = result.current;
    act(() => {
      vi.advanceTimersByTime(MINUTE_TICK_MS - 1);
    });
    expect(result.current).toBe(first);
    expect(MINUTE_TICK_MS * 2).toBe(60_000);
  });

  it('starts from now rather than from whenever the tab was opened', () => {
    vi.setSystemTime(new Date('2026-09-12T10:00:00Z'));
    const { result } = renderHook(() => useNow());
    expect(result.current).toBe(Date.parse('2026-09-12T10:00:00Z'));
  });

  it('stops ticking when whatever was elapsing has gone', () => {
    // One timer per card on a page of forty is the version of this that costs something.
    const { unmount } = renderHook(() => useNow());
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
