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
  it('opens on Enter', async () => {
    const onOpen = vi.fn();
    render(<RecordingRow name="A recording" duration="48:12" onOpen={onOpen} />);
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('picks on Space rather than opening, because those are two different acts', async () => {
    // §1.8's model, which `UI-9d` implements: a row is a thing you open and a thing you pick, and
    // one key doing both leaves the other unreachable from a keyboard. This row used to open on
    // Space, which is what that test asserted.
    const onOpen = vi.fn();
    const onSelect = vi.fn();
    render(
      <RecordingRow name="A recording" duration="48:12" onOpen={onOpen} onSelect={onSelect} />,
    );
    screen.getByRole('button').focus();
    await userEvent.keyboard(' ');
    expect(onSelect).toHaveBeenCalledWith(true);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('lets Space through when the row offers no selection', () => {
    // There it means play or pause, and a row that swallowed it would break the player.
    const onOpen = vi.fn();
    render(<RecordingRow name="A recording" duration="48:12" onOpen={onOpen} />);
    const row = screen.getByRole('button');
    row.focus();
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    row.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('draws no heart unless marking is offered', () => {
    render(<RecordingRow name="A recording" duration="48:12" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Favourite A recording' })).toBeNull();
  });

  it('marks on a click or on Enter, and opens on neither (UI-41)', async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(
      <RecordingRow
        name="A recording"
        duration="48:12"
        onOpen={onOpen}
        favourite={{ on: true, onToggle }}
      />,
    );
    const heart = screen.getByRole('button', { name: 'Favourite A recording' });
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(heart);
    heart.focus();
    await userEvent.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onOpen).not.toHaveBeenCalled();
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
