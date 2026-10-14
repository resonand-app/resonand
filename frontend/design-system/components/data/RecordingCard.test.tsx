/**
 * The heart on a card (`UI-41`): drawn only where marking is offered, and a control of its own --
 * pressing it marks the recording and does not open it.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RecordingCard } from './RecordingCard';

describe('RecordingCard', () => {
  it('draws no heart unless marking is offered', () => {
    render(<RecordingCard name="A recording" onOpen={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Favourite A recording' })).toBeNull();
  });

  it('says whether it is marked with aria-pressed, not with a second name', () => {
    const { rerender } = render(
      <RecordingCard name="A recording" favourite={{ on: false, onToggle: vi.fn() }} />,
    );
    const heart = screen.getByRole('button', { name: 'Favourite A recording' });
    expect(heart.getAttribute('aria-pressed')).toBe('false');
    rerender(<RecordingCard name="A recording" favourite={{ on: true, onToggle: vi.fn() }} />);
    expect(heart.getAttribute('aria-pressed')).toBe('true');
  });

  it('marks the recording without opening it', async () => {
    const onOpen = vi.fn();
    const onToggle = vi.fn();
    render(<RecordingCard name="A recording" onOpen={onOpen} favourite={{ on: false, onToggle }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Favourite A recording' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
