/**
 * The interface and the backend cannot drift about what a permission means (`UI-34k`).
 *
 * That is the whole of this component. The wording lives in `sonarium/core/levels.py` and arrives
 * as `level_description` on every share; nothing here has a string of its own to go stale. A copy
 * in the interface is a copy somebody eventually edits, and then the product describes a
 * permission it does not grant -- on the screen where the product's first promise is kept.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LevelSelector } from './LevelSelector';

/** Exactly what the API sends, owner included. */
const LEVELS = [
  { level: 10, description: 'Can read: listen and read the transcript, and change nothing.' },
  { level: 20, description: 'Can edit: change titles, categories and tags, but not share.' },
  { level: 30, description: 'Can manage: everything above, plus sharing with other people.' },
  { level: 40, description: 'Owner: the library belongs to them.' },
];

describe('LevelSelector', () => {
  it('renders the words the API sent, not words of its own', () => {
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={20} onChange={vi.fn()} />);
    expect(screen.getByText('listen and read the transcript, and change nothing.')).toBeDefined();
    expect(screen.getByText('change titles, categories and tags, but not share.')).toBeDefined();
  });

  it('drops owner rather than drawing it disabled', () => {
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={20} onChange={vi.fn()} />);
    // Ownership is not a grant -- the backend reads it off `library.owner_id` and a CHECK refuses
    // a share row carrying it -- so an option nobody can ever pick is not in the list.
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByText(/the library belongs to them/)).toBeNull();
  });

  it('keeps the wording visible rather than behind anything', () => {
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={10} onChange={vi.fn()} />);
    // No hover, no focus, no tooltip: the sentence is on the page when the page is.
    expect(screen.getByText('listen and read the transcript, and change nothing.')).toBeVisible();
  });

  it('draws a description with no colon whole', () => {
    // What happens if the backend rewords them. Splitting is a presentation detail and must never
    // be able to lose half a sentence.
    render(
      <LevelSelector
        label="What Sam Rivera can do"
        levels={[{ level: 10, description: 'Listen and change nothing' }]}
        value={10}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Listen and change nothing')).toBeDefined();
  });

  it('says which level is granted', () => {
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={30} onChange={vi.fn()} />);
    expect(screen.getByRole('radio', { checked: true })).toHaveTextContent('Can manage');
  });

  it('is one tab stop, and the arrows choose', async () => {
    const onChange = vi.fn();
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={20} onChange={onChange} />);
    const chosen = screen.getByRole('radio', { checked: true });
    expect(chosen).toHaveAttribute('tabindex', '0');
    chosen.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('chooses on a click', async () => {
    const onChange = vi.fn();
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={10} onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: /Can manage/ }));
    expect(onChange).toHaveBeenCalledWith(30);
  });

  it('is a named group, because "read" alone means nothing', () => {
    render(<LevelSelector label="What Sam Rivera can do" levels={LEVELS} value={10} onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'What Sam Rivera can do' })).toBeDefined();
  });
});
