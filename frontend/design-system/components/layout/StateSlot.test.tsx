/**
 * The two empty states that look alike and are not (`UI-35c`).
 *
 * §3.5 calls it the classic mistake: "no recordings yet" is a new library, "no recordings match
 * that tag" is a mistyped filter, and the second is recoverable in a way the first is not. Drawing
 * them from one component is what keeps the difference deliberate rather than a copy-paste
 * somebody forgot to edit.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardSkeleton, RowSkeleton, StateCard } from './StateSlot';

describe('StateCard', () => {
  it('invites an action where there is nothing yet', () => {
    render(
      <StateCard
        icon="library"
        title="No recordings yet"
        body="Upload audio to get started."
        action={<button type="button">Upload audio</button>}
        dashed
      />,
    );
    expect(screen.getByText('No recordings yet')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Upload audio' })).toBeDefined();
  });

  it('offers a way back where a filter matched nothing', () => {
    const { container } = render(
      <StateCard
        icon="search"
        title="No recordings match memòria"
        action={<button type="button">Clear the filter</button>}
        footnote="37 recordings in the library"
      />,
    );
    expect(screen.getByRole('button', { name: 'Clear the filter' })).toBeDefined();
    // The count is the recovery: it says the library is not empty, which is the whole difference
    // between this state and the one above.
    expect(screen.getByText('37 recordings in the library')).toBeDefined();
    // And it is not the dashed treatment, which means an empty place rather than a filtered one.
    expect(container.querySelector('[data-dashed]')).toBeNull();
  });

  it('shows the problem document rather than substituting its own wording', () => {
    // §1.9: `detail` is written to be shown to a person, so the interface shows it.
    render(
      <StateCard
        icon="alert-circle"
        title="That library could not be loaded"
        body="The instance could not be reached."
        action={<button type="button">Try again</button>}
      />,
    );
    expect(screen.getByText('The instance could not be reached.')).toBeDefined();
  });
});

describe('the skeletons', () => {
  it('are the shape of the thing that is coming', () => {
    // A card skeleton that is a grey rectangle is a page that jumps when the data arrives.
    const { container } = render(<CardSkeleton />);
    expect(container.querySelectorAll('[data-ds="skeleton-block"]').length).toBeGreaterThan(2);
  });

  it('say nothing to a screen reader', () => {
    // There is nothing here to read: the announcement is the content arriving.
    const { container } = render(<RowSkeleton />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('do not move', () => {
    // The transcript following playback is the only thing in this product that moves on its own.
    // A loading state that animated would be the second, on every screen, for everybody.
    const { container } = render(<CardSkeleton />);
    for (const block of container.querySelectorAll<HTMLElement>('[data-ds="skeleton-block"]')) {
      expect(block.style.animation).toBe('');
      expect(block.style.transition).toBe('');
    }
  });
});
