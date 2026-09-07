/**
 * The three ways out of a sheet, and the one thing it stops (`UI-34g`).
 *
 * A sheet is the phone's only panel, so it is the one place where getting dismissal wrong means a
 * screen somebody cannot leave. `Esc` and the scrim come from `UI-34a` and are checked there; the
 * drag is this component's own, and it is the one a finger will actually use.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Sheet } from './Sheet';

/**
 * A pointer drag, as three events.
 *
 * jsdom has no pointer capture, so `setPointerCapture` is stubbed per element. Testing Library's
 * `pointer` API does not model capture either, which is why these are dispatched by hand.
 */
function drag(element: HTMLElement, from: number, to: number) {
  element.setPointerCapture = vi.fn();
  element.dispatchEvent(new MouseEvent('pointerdown', { clientY: from, bubbles: true }));
  element.dispatchEvent(new MouseEvent('pointermove', { clientY: to, bubbles: true }));
  element.dispatchEvent(new MouseEvent('pointerup', { clientY: to, bubbles: true }));
}

describe('Sheet', () => {
  it('is not there when it is closed', () => {
    render(
      <Sheet open={false} onClose={vi.fn()} title="Metadata">
        <p>Recorded 11 Mar 2024</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is a modal dialog with a name', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Metadata">
        <p>Recorded 11 Mar 2024</p>
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Metadata' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
  });

  it('stops the page underneath from scrolling, and starts it again', () => {
    const { unmount } = render(
      <Sheet open onClose={vi.fn()} title="Metadata">
        <p>Recorded</p>
      </Sheet>,
    );
    // The thing a menu must never do and a cover always must.
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('closes on a drag past the grabber', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Metadata">
        <p>Recorded</p>
      </Sheet>,
    );
    drag(screen.getByRole('dialog'), 400, 500);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('springs back from a drag that stops short', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Metadata">
        <p>Recorded</p>
      </Sheet>,
    );
    // The gesture is reversible while it is happening rather than after: a finger that changes
    // its mind halfway has changed its mind.
    drag(screen.getByRole('dialog'), 400, 430);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveStyle({ translate: '0 0px' });
  });

  it('does not follow a finger upwards', () => {
    render(
      <Sheet open onClose={vi.fn()} title="Metadata">
        <p>Recorded</p>
      </Sheet>,
    );
    const sheet = screen.getByRole('dialog');
    sheet.setPointerCapture = vi.fn();
    sheet.dispatchEvent(new MouseEvent('pointerdown', { clientY: 400, bubbles: true }));
    sheet.dispatchEvent(new MouseEvent('pointermove', { clientY: 300, bubbles: true }));
    // A sheet dragged upwards is somebody trying to make it taller, and it has one height.
    expect(sheet).toHaveStyle({ translate: '0 0px' });
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Metadata">
        <p>Recorded</p>
      </Sheet>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
