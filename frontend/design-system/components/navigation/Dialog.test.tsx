/**
 * A dialog says it is one (`UI-34a1`).
 *
 * `Modal` supplies the modality -- the scrim, the trap, `Esc` -- and none of that reaches a screen
 * reader's browse mode, which walks the document rather than following focus. `aria-modal` is the
 * one statement that does, and it belongs on the element carrying `role="dialog"`, which is this.
 * `Sheet` and `TypedConfirm` have said it since they were written; this had not.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('is a modal dialog with a name', () => {
    render(<Dialog title="Rename library" />);
    const dialog = screen.getByRole('dialog', { name: 'Rename library' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('says the same thing the other two panels say', () => {
    // The point of the fix: three panels, one statement. A reader meeting any of them is told the
    // rest of the page is not available, and is told it the same way.
    render(<Dialog title="Move" />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('carries its consequence where a confirm needs it', () => {
    render(
      <Dialog title="Delete library" description="This also deletes its 84 recordings." />,
    );
    expect(screen.getByText('This also deletes its 84 recordings.')).toBeInTheDocument();
  });

  it('names its close control from the copy it is given', async () => {
    const onClose = vi.fn();
    render(<Dialog title="Share" onClose={onClose} labels={{ close: 'Cerrar' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
