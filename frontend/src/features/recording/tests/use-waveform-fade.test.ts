/**
 * Which surface draws the waveform, and when it changes hands (`UI-11g`, `UI-11h`).
 *
 * The rule the screen rests on is that **exactly one waveform moves at a time**: the detail
 * view's while it is on screen, the bar's once it has scrolled away. Both halves of that are
 * failures somebody would report -- two shapes at two scales drifting apart reads as two players,
 * and no shape at all reads as a player that has lost half of itself.
 *
 * Tested here rather than through the view because it is arithmetic over a scroll position and an
 * element's height, and jsdom performs no layout to produce either: the heights below are stated
 * rather than measured, which is what makes the thresholds assertable at all.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useOnScreenWaveform } from '@/player/on-screen';

import { useWaveformFade } from '../use-waveform-fade';

const RECORDING = 'aaaaaaaa-0000-4000-8000-000000000001';

/** The panel's height, and the travel the fade is spread over: 80% of it. */
const PANEL = 200;
const TRAVEL = 160;

afterEach(() => {
  useOnScreenWaveform.setState({ uuid: null });
  document.body.replaceChildren();
});

/** A column with a panel in it, at heights jsdom would otherwise report as zero. */
function aColumn(): { column: HTMLElement; panel: HTMLElement; scrollTo: (top: number) => void } {
  const column = document.createElement('div');
  const panel = document.createElement('section');
  Object.defineProperty(column, 'scrollTop', { value: 0, writable: true, configurable: true });
  Object.defineProperty(panel, 'offsetHeight', { value: PANEL, configurable: true });
  column.append(panel);
  document.body.append(column);
  return {
    column,
    panel,
    scrollTo: (top: number) => {
      column.scrollTop = top;
      column.dispatchEvent(new Event('scroll'));
    },
  };
}

/** The hook hands back the ref; the panel is what a render would have put in it. */
function fading(column: HTMLElement, panel: HTMLElement) {
  const rendered = renderHook(() => useWaveformFade({ current: column }, RECORDING));
  rendered.result.current.current = panel;
  rendered.rerender();
  return rendered;
}

/** What the bar reads. */
function drawnBy(): string | null {
  return useOnScreenWaveform.getState().uuid;
}

describe('while the panel is on screen', () => {
  it('is the panel that draws the waveform, so the bar collapses to the position', async () => {
    const { column, panel } = aColumn();
    fading(column, panel);
    await waitFor(() => {
      expect(drawnBy()).toBe(RECORDING);
    });
  });

  it('fades the panel by how far the column has taken it', async () => {
    const { column, panel, scrollTo } = aColumn();
    fading(column, panel);
    await waitFor(() => {
      expect(panel.style.opacity).toBe('1');
    });
    act(() => {
      scrollTo(TRAVEL / 2);
    });
    await waitFor(() => {
      expect(panel.style.opacity).toBe('0.5');
    });
  });
});

describe('once it has gone', () => {
  it('hands the waveform to the bar, which is the only one left to draw it', async () => {
    const { column, panel, scrollTo } = aColumn();
    fading(column, panel);
    await waitFor(() => {
      expect(drawnBy()).toBe(RECORDING);
    });
    act(() => {
      scrollTo(TRAVEL);
    });
    await waitFor(() => {
      expect(drawnBy()).toBeNull();
    });
  });

  it('takes the panel out of reach, because an invisible seek control is still one', async () => {
    const { column, panel, scrollTo } = aColumn();
    fading(column, panel);
    act(() => {
      scrollTo(TRAVEL);
    });
    await waitFor(() => {
      expect(panel.inert).toBe(true);
    });
  });

  it('does not take it back on the way out, which is what would make the bar flicker', async () => {
    // Between the two thresholds: a trackpad's own jitter around one number would otherwise
    // hand the waveform back and forth a few times a second.
    const { column, panel, scrollTo } = aColumn();
    fading(column, panel);
    act(() => {
      scrollTo(TRAVEL);
    });
    await waitFor(() => {
      expect(drawnBy()).toBeNull();
    });
    act(() => {
      scrollTo(TRAVEL * 0.875);
    });
    await waitFor(() => {
      expect(panel.style.opacity).toBe('0.125');
    });
    expect(drawnBy()).toBeNull();
  });

  it('takes it back once the panel is properly on screen again', async () => {
    const { column, panel, scrollTo } = aColumn();
    fading(column, panel);
    act(() => {
      scrollTo(TRAVEL);
    });
    await waitFor(() => {
      expect(drawnBy()).toBeNull();
    });
    act(() => {
      scrollTo(TRAVEL / 2);
    });
    await waitFor(() => {
      expect(drawnBy()).toBe(RECORDING);
    });
  });
});

describe('leaving the screen', () => {
  it('hands the waveform back, because the panel is not there to draw it', async () => {
    const { column, panel } = aColumn();
    const { unmount } = fading(column, panel);
    await waitFor(() => {
      expect(drawnBy()).toBe(RECORDING);
    });
    unmount();
    expect(drawnBy()).toBeNull();
  });

  it('does nothing at all where there is no column, which is the phone', () => {
    const { panel } = aColumn();
    const rendered = renderHook(() => useWaveformFade(undefined, RECORDING));
    rendered.result.current.current = panel;
    rendered.rerender();
    // The phone shell hands its views no settled height, so the panel does not scroll away and
    // the bar has no waveform to take over (`DEC-23`).
    expect(drawnBy()).toBeNull();
    expect(panel.style.opacity).toBe('');
  });
});
