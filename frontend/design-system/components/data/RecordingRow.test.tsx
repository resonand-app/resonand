/**
 * A row that opens is a control (`UI-1g`).
 *
 * Same change and same reasoning as `TranscriptLine`: the `.jsx` put `onClick` on a bare `<div>`,
 * which is a row nobody can open without a mouse. `LibraryCard` deliberately does not get this
 * treatment -- it contains the overflow button, and a role on the outer element would swallow it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecordingRow } from './RecordingRow';

describe('RecordingRow', () => {
  it('opens on Enter and on Space', async () => {
    const onOpen = vi.fn();
    render(<RecordingRow name="A recording" duration="48:12" onOpen={onOpen} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('is not a control when there is nothing to open', () => {
    render(<RecordingRow name="A recording" duration="48:12" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the duration verbatim, in the column that is always there', () => {
    // Title, duration, state and play never collapse (`UI-7b`).
    render(<RecordingRow name="A recording" duration="1:12:40" state="running" />);
    expect(screen.getByText('1:12:40')).toBeDefined();
  });
});
