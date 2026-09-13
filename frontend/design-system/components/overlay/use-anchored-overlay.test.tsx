/**
 * The behaviour five overlays share, checked once (`UI-34a`).
 *
 * This is the task on the critical path, and it is on it because getting it wrong is expensive in
 * five places at the same time. So the four things that are hard to get right are each asserted
 * here rather than in `Select`, `Menu`, `Tooltip`, `Toast` and `Sheet`: where the surface lands,
 * that `Tab` cannot leave it, that `Esc` and an outside pointer close it, and that focus goes back
 * where it came from.
 *
 * jsdom has no layout, so every `getBoundingClientRect` is zeroes unless a test says otherwise.
 * The placement tests stub the two boxes, which is honest about what is being checked: the
 * arithmetic that decides a side, not the browser's idea of where a button is.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useAnchoredOverlay } from './use-anchored-overlay';
import type { Placement } from './use-anchored-overlay';

/** A minimal consumer: a trigger, a surface, two things to focus inside it. */
function Harness({
  placement = 'bottom',
  modal = true,
  lockScroll = false,
  onClose,
}: {
  placement?: Placement;
  modal?: boolean;
  lockScroll?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  const { anchorRef, surfaceRef, surfaceStyle } = useAnchoredOverlay<HTMLButtonElement>({
    open,
    onClose: close,
    placement,
    modal,
    lockScroll,
  });

  return (
    <div>
      <button
        type="button"
        ref={anchorRef}
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <button type="button">Outside</button>
      {open && (
        <div ref={surfaceRef} style={surfaceStyle}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      )}
    </div>
  );
}

/** Give the two boxes real coordinates, since jsdom will not. */
function stubBoxes(anchor: Partial<DOMRect>, surface: Partial<DOMRect>) {
  const rect = (box: Partial<DOMRect>) =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, ...box }) as DOMRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return rect(this.tagName === 'BUTTON' ? anchor : surface);
  });
}

describe('placement', () => {
  it('sits below its anchor when there is room', async () => {
    window.innerHeight = 800;
    window.innerWidth = 1280;
    stubBoxes(
      { top: 100, bottom: 134, left: 200, right: 232, width: 32, height: 34 },
      { width: 200, height: 180 },
    );
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'First' }).parentElement).toHaveAttribute(
      'data-placement',
      'bottom',
    );
    vi.restoreAllMocks();
  });

  it('flips above rather than hanging off the bottom of the screen', async () => {
    window.innerHeight = 800;
    // An anchor near the bottom, and a menu taller than the room under it. This is the case that
    // matters: a menu whose last item is "Delete permanently" must not render below the fold.
    stubBoxes({ top: 700, bottom: 734, left: 200, right: 232, width: 32, height: 34 }, { width: 200, height: 180 });
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'First' }).parentElement).toHaveAttribute(
      'data-placement',
      'top',
    );
    vi.restoreAllMocks();
  });

  it('takes the roomier side when neither side fits', async () => {
    window.innerHeight = 200;
    // A menu taller than the whole window. It cannot be shown in full either way, so the choice
    // is which side loses fewer items -- and above this anchor there is 84px against 70 below.
    stubBoxes(
      { top: 90, bottom: 124, left: 10, right: 42, width: 32, height: 34 },
      { width: 200, height: 400 },
    );
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'First' }).parentElement).toHaveAttribute(
      'data-placement',
      'top',
    );
    vi.restoreAllMocks();
  });

  it('answers the same way whichever side was asked for', async () => {
    // The rule is about room and not about a preferred direction, so asking for `top` in a
    // window with more space below gets the same answer as asking for `bottom` would.
    window.innerHeight = 800;
    stubBoxes(
      { top: 100, bottom: 134, left: 200, right: 232, width: 32, height: 34 },
      { width: 200, height: 700 },
    );
    render(<Harness placement="top" />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    // 666px below against 94 above, and 700 needed: neither fits, so below wins.
    expect(screen.getByRole('button', { name: 'First' }).parentElement).toHaveAttribute(
      'data-placement',
      'bottom',
    );
    vi.restoreAllMocks();
  });

  it('is fixed, so no ancestor can clip it', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    const surface = screen.getByRole('button', { name: 'First' }).parentElement;
    expect(surface).toHaveStyle({ position: 'fixed' });
  });

  it('is measured before it is ever painted', async () => {
    // The frame where a surface is at the top left of the window on its way to its anchor. The
    // positioning is a layout effect for this reason, so by the time a test can observe the
    // element it is already placed and visible -- never `hidden`, which is how it starts.
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'First' }).parentElement).toHaveStyle({
      visibility: 'visible',
    });
  });
});

describe('focus', () => {
  it('moves into the overlay on open and back to the anchor on close', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    // Back to the button that opened it, ready to open it again -- not to the body, which is
    // where a keyboard has to start over from the top of the page.
    expect(trigger).toHaveFocus();
  });

  it('wraps at both ends rather than letting Tab out', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await userEvent.tab();
    // Round to the first, and never to "Outside": an overlay you can tab out of is one that
    // stays open behind whatever you tabbed into.
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('leaves focus alone when it is not modal', async () => {
    // A tooltip describes a control without becoming the thing you are doing. Trapping focus in
    // one strands a keyboard on a hint about a control it can no longer reach.
    render(<Harness modal={false} />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(trigger);
    expect(trigger).toHaveFocus();
  });
});

describe('dismissal', () => {
  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
  });

  it('closes on a pointer outside it', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Outside' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for a pointer inside it, and for one on its own anchor', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Last' }));
    // The anchor too: a trigger that toggles would otherwise close and reopen on one click, and
    // appear not to work at all.
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('lets go of the document when it closes', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    unmount();
    // A listener left on `document` after the overlay is gone is one that closes an overlay
    // nobody opened, and the leak is invisible until a view mounts a hundred rows with menus.
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('scroll', () => {
  it('locks the page only when asked', async () => {
    const { unmount } = render(<Harness lockScroll />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('leaves the page scrolling for a menu', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    // A menu is attached to a row in a list. Locking the page while one is open makes the list
    // unusable, so the menu follows its anchor instead.
    expect(document.documentElement.style.overflow).toBe('');
  });
});
