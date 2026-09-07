/**
 * A failure toast is a different shape from a success one, and the difference is the point
 * (`UI-34h`).
 *
 * Partial failure is the *normal* case for a bulk action here -- there is no bulk endpoint, so 200
 * recordings is 200 requests and some of them fail (§3.5). A toast that could only say "done"
 * would be a toast that lies once a fortnight.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Toast } from './Toast';

describe('Toast', () => {
  it('says what happened, in the numbers it was given', () => {
    render(<Toast>12 recordings moved to Àvia Teresa</Toast>);
    expect(screen.getByText('12 recordings moved to Àvia Teresa')).toBeDefined();
  });

  it('carries actions for a failure and none for a success', () => {
    const { rerender } = render(<Toast>12 recordings moved</Toast>);
    expect(screen.queryByRole('button', { name: 'Retry 3' })).toBeNull();
    rerender(
      <Toast tone="failed" actions={<button type="button">Retry 3</button>}>
        9 moved, 3 failed.
      </Toast>,
    );
    expect(screen.getByRole('button', { name: 'Retry 3' })).toBeDefined();
  });

  it('tells the two apart with a glyph and not only a colour', () => {
    // The rule the four transcription states are held to, held here as well: somebody who cannot
    // see the difference between the green and the red still has to be able to read the toast.
    const { rerender, container } = render(<Toast>Done</Toast>);
    expect(container.querySelector('[data-tone="done"]')).not.toBeNull();
    const success = container.innerHTML;
    rerender(<Toast tone="failed">Failed</Toast>);
    expect(container.querySelector('[data-tone="failed"]')).not.toBeNull();
    expect(container.innerHTML).not.toBe(success);
  });

  it('can be put away by hand', async () => {
    const onDismiss = vi.fn();
    render(<Toast onDismiss={onDismiss}>12 recordings moved</Toast>);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('has no dismiss control when nobody is listening for one', () => {
    // A button that does nothing is worse than no button, and a toast in a region that dismisses
    // its own children does not need one.
    render(<Toast>12 recordings moved</Toast>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });
});
