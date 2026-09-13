/**
 * Follow and release (`UI-12b`, §V5).
 *
 * 🧪 The task's own criterion: **a programmatic scroll does not release, a user scroll does.**
 * Both arrive as the same event on the same element, so this is the one piece of the screen where
 * a test is the only thing standing between the intended behaviour and its opposite -- and its
 * opposite is a transcript that stops following itself the instant it starts.
 *
 * It is tested here rather than through the view because the distinction is about a sequence of
 * events and a timer, and asserting on it through a rendered transcript would mean asserting on
 * the scroll position of a scroller jsdom performs no layout for.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OWN_SCROLL_MS, useFollow } from '../use-follow';

/**
 * A scroller with a viewport, because jsdom gives every element a height of zero.
 *
 * `scrollTo` is recorded rather than performed: jsdom implements no scrolling, and what is under
 * test is what the hook asks for and what it does with the events that come back.
 */
function aScroller(): { element: HTMLElement; scrolled: ScrollToOptions[] } {
  const element = document.createElement('div');
  const scrolled: ScrollToOptions[] = [];
  Object.defineProperty(element, 'clientHeight', { value: 300, configurable: true });
  Object.defineProperty(element, 'scrollHeight', { value: 3000, configurable: true });
  Object.defineProperty(element, 'scrollTop', { value: 0, writable: true, configurable: true });
  element.scrollTo = (options?: ScrollToOptions | number) => {
    if (typeof options === 'object') scrolled.push(options);
  };
  document.body.append(element);
  return { element, scrolled };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('telling our own scroll from theirs', () => {
  it('follows to begin with, because opening a recording is asking to be shown it', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    expect(result.current.following).toBe(true);
  });

  it('keeps following through a scroll it caused itself', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.centreOn(900);
    });
    // The event the browser sends back for the movement we just asked for. Releasing here is the
    // bug: the transcript would stop following on the first line it followed to.
    act(() => {
      result.current.onScroll();
    });
    expect(result.current.following).toBe(true);
  });

  it('keeps following through every frame of a smooth scroll, however long it takes', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, true));
    act(() => {
      result.current.centreOn(900);
    });
    // A smooth scroll is one event per frame until it arrives, which outlasts any fixed window.
    // Each of ours re-arms the flag, so the window closes after the movement rather than during.
    for (let frame = 0; frame < 20; frame += 1) {
      act(() => {
        vi.advanceTimersByTime(16);
        result.current.onScroll();
      });
    }
    expect(result.current.following).toBe(true);
  });

  it('releases on a scroll it did not cause', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.onScroll();
    });
    expect(result.current.following).toBe(false);
  });

  it('releases once its own scroll is far enough in the past', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.centreOn(900);
    });
    act(() => {
      vi.advanceTimersByTime(OWN_SCROLL_MS + 1);
    });
    act(() => {
      result.current.onScroll();
    });
    expect(result.current.following).toBe(false);
  });

  it('releases on a wheel even in the middle of its own animation', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, true));
    act(() => {
      result.current.centreOn(900);
    });
    // The case the flag alone gets wrong: somebody reaches for the wheel while the transcript is
    // animating, and re-arming would attribute their scroll to us. A wheel cannot be anything
    // but a person.
    act(() => {
      element.dispatchEvent(new Event('wheel'));
    });
    expect(result.current.following).toBe(false);
  });

  it('releases on a touch drag as well, for the same reason', () => {
    const { element } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, true));
    act(() => {
      result.current.centreOn(900);
    });
    act(() => {
      element.dispatchEvent(new Event('touchmove'));
    });
    expect(result.current.following).toBe(false);
  });

  it('takes it up again when asked, and follows the next line', () => {
    const { element, scrolled } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.onScroll();
    });
    act(() => {
      result.current.resume();
    });
    expect(result.current.following).toBe(true);
    act(() => {
      result.current.centreOn(1200);
    });
    expect(scrolled.at(-1)).toEqual({ top: 1200, behavior: 'auto' });
  });
});

describe('what it asks the browser for', () => {
  it('scrolls smoothly, or not at all when the device asked for less movement', () => {
    const calm = aScroller();
    const { result: smooth } = renderHook(() => useFollow({ current: calm.element }, true));
    act(() => {
      smooth.current.centreOn(400);
    });
    expect(calm.scrolled).toEqual([{ top: 400, behavior: 'smooth' }]);

    const still = aScroller();
    const { result: instant } = renderHook(() => useFollow({ current: still.element }, false));
    act(() => {
      instant.current.centreOn(400);
    });
    // `prefers-reduced-motion` cannot be honoured by a stylesheet here: nothing a token declares
    // reaches inside a `scrollTo` (`UI-32c`).
    expect(still.scrolled).toEqual([{ top: 400, behavior: 'auto' }]);
  });

  it('does not claim a scroll that would not move anything', () => {
    const { element, scrolled } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.centreOn(2);
    });
    // Two pixels from where it already is. Arming the flag for a movement that never happens
    // would leave an 80 ms window in which a person's own scroll reads as ours.
    expect(scrolled).toEqual([]);
    act(() => {
      result.current.onScroll();
    });
    expect(result.current.following).toBe(false);
  });

  it('never asks for a position past the end of the transcript', () => {
    const { element, scrolled } = aScroller();
    const { result } = renderHook(() => useFollow({ current: element }, false));
    act(() => {
      result.current.centreOn(9_000);
    });
    // 3000 of content in a 300 viewport. A target past the end is one the browser clamps and
    // this one does not: the comparison above is against where it can actually go, so the last
    // line does not re-scroll on every position report.
    expect(scrolled).toEqual([{ top: 2700, behavior: 'auto' }]);
  });
});
