/**
 * A line that seeks is a control (`UI-1f`).
 *
 * The `.jsx` this replaces put `onClick` on a bare `<div>`: a seek nobody can perform without a
 * mouse, on the one screen the product exists for. The keyboard path is asserted here rather than
 * left to `UI-12c`, because `UI-12c` is about moving *between* segments and this is about
 * operating one.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TranscriptLine } from './TranscriptLine';

describe('TranscriptLine', () => {
  it('seeks on Enter and on Space when it has somewhere to seek to', async () => {
    const onClick = vi.fn();
    render(
      <TranscriptLine at="18:04" onClick={onClick}>
        the third segment mentions rehearsal, which is the word search is asked for
      </TranscriptLine>,
    );
    const line = screen.getByRole('button');
    line.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('stays inert text when there is nothing to seek to', () => {
    // A transcript in a read-only view is not a list of buttons, and a tab stop per segment
    // would make the page unnavigable long before it made it usable.
    render(<TranscriptLine at="18:04">the same line, not a control</TranscriptLine>);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the timestamp beside the words', () => {
    render(<TranscriptLine at="1:12:40">later on</TranscriptLine>);
    expect(screen.getByText('1:12:40')).toBeDefined();
  });
});
