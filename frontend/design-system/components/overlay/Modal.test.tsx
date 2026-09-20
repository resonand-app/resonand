/**
 * The half of a dialog that is not drawing (`UI-34a`, `UI-34a1`).
 *
 * `Dialog` is a shape and this is a behaviour, which is why they are two components. What is held
 * here is the behaviour a person can get wrong by escaping it: the keyboard must not reach the
 * page behind, and there must be more than one way out.
 *
 * Together with `Dialog`'s `aria-modal` these are the three vectors a modal has to close -- the
 * pointer, the keyboard and the virtual cursor -- which is the argument for not also giving the
 * background the `inert` attribute, written out where that decision lives, in `Dialog`.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from '../navigation/Dialog';
import { Modal } from './Modal';

function openOver(background: string, onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <>
        <button type="button">{background}</button>
        <Modal open onClose={onClose}>
          <Dialog title="Rename library" onClose={onClose} labels={{ close: 'Close' }}>
            <input aria-label="Name" />
          </Dialog>
        </Modal>
      </>,
    ),
  };
}

describe('Modal', () => {
  it('draws nothing at all when it is closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()}>
        <Dialog title="Rename library" />
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the keyboard inside the panel', async () => {
    openOver('Behind the dialog');
    const behind = screen.getByRole('button', { name: 'Behind the dialog' });

    // Round the panel twice: a trap that only holds for one pass is a trap with an exit in it.
    for (let press = 0; press < 6; press += 1) {
      await userEvent.tab();
      expect(document.activeElement).not.toBe(behind);
    }
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes on Escape', async () => {
    const { onClose } = openOver('Behind the dialog');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on a pointer outside the panel', async () => {
    const { onClose, container } = openOver('Behind the dialog');
    const scrim = container.querySelector('[data-ds="scrim"]');
    expect(scrim).not.toBeNull();
    await userEvent.click(scrim as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it('covers the whole viewport with the scrim, so nothing behind is clickable', () => {
    const { container } = openOver('Behind the dialog');
    const scrim = container.querySelector<HTMLElement>('[data-ds="scrim"]');
    expect(scrim?.style.position).toBe('fixed');
    expect(scrim?.style.inset).toBe('0px');
    // Hidden from assistive technology: it is a click target and not a thing to read.
    expect(scrim).toHaveAttribute('aria-hidden');
  });
});
