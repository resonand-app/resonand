/**
 * Putting a scrollport back, and the two reasons to stop trying (`FBK-8`).
 *
 * jsdom lets any `scrollTop` stand, which is the one thing a real browser will not do and the
 * whole reason `putBack` asks more than once -- so the clamp is put back here deliberately. What
 * is under test is the giving up: a list whose content never arrives must not be asked for ever,
 * and a hand on the wheel must win immediately.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { putBack } from '@/app/scroll';

/** A scrollport that clamps, as a browser does: `reach` is how far its content currently goes. */
function scrollport(reach: number) {
  const element = document.createElement('div');
  let top = 0;
  Object.defineProperty(element, 'scrollTop', {
    get: () => top,
    set: (asked: number) => {
      top = Math.min(asked, reach);
      element.dispatchEvent(new Event('scroll'));
    },
  });
  document.body.append(element);
  return {
    element,
    grow: (to: number) => {
      reach = to;
    },
    /** What a hand on the wheel does, which is a scroll nothing here asked for. */
    scrolledByHand: (to: number) => {
      reach = Math.max(reach, to);
      element.scrollTop = to;
    },
  };
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance'] });
});

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('putting a scrollport back', () => {
  it('keeps asking until the content is long enough to hold the offset', async () => {
    const port = scrollport(100);
    putBack(port.element, 400);

    await frame();
    // Everything the list has so far, which is not where somebody was.
    expect(port.element.scrollTop).toBe(100);

    port.grow(400);
    await frame();
    await frame();
    expect(port.element.scrollTop).toBe(400);
  });

  it('gives up on a list that never gets long enough, rather than asking for ever', async () => {
    const port = scrollport(100);
    putBack(port.element, 400);

    await frame();
    vi.advanceTimersByTime(5000);
    await frame();
    await frame();

    // The content arrives far too late to be what anybody is still waiting for.
    port.grow(400);
    await frame();
    await frame();
    expect(port.element.scrollTop).toBe(100);
  });

  it('gives way the moment somebody scrolls for themselves', async () => {
    const port = scrollport(100);
    putBack(port.element, 400);

    await frame();
    port.scrolledByHand(50);
    port.grow(400);
    await frame();
    await frame();

    // A restoration that wins a fight with a hand on the wheel is worse than one that never was.
    expect(port.element.scrollTop).toBe(50);
  });

  it('does nothing at all for the top, which is where a screen starts anyway', async () => {
    const port = scrollport(400);
    port.scrolledByHand(120);
    putBack(port.element, 0);

    await frame();
    expect(port.element.scrollTop).toBe(120);
  });
});
