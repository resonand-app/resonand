/**
 * A recording with its matches, three of them (`UI-35j`).
 *
 * Search is across everything somebody has ever recorded, so the unit of a result is a recording
 * and not a line: forty matches in one interview are one result, never forty. Past three, the
 * question has stopped being "which recording" and started being "where in it", which is a
 * different screen.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ResultGroup } from './ResultGroup';

const MATCHES = [
  { id: 1, at: '18:01', text: 'I la casa de Carrer Nou tenia un balcó.' },
  { id: 2, at: '18:04', text: 'La iaia hi estenia la roba.' },
  { id: 3, at: '18:11', text: 'Això era abans de la guerra.' },
  { id: 4, at: '19:40', text: 'El mercat era al capdavall del carrer.' },
  { id: 5, at: '22:02', text: 'Hi anàvem cada dissabte.' },
];

describe('ResultGroup', () => {
  it('shows three matches and counts the rest', () => {
    render(
      <ResultGroup title="Entrevista amb l’àvia Teresa" matches={MATCHES} onShowAll={vi.fn()} />,
    );
    expect(screen.getByText('La iaia hi estenia la roba.')).toBeDefined();
    expect(screen.queryByText('Hi anàvem cada dissabte.')).toBeNull();
    expect(screen.getByRole('button', { name: '+2 more in this recording' })).toBeDefined();
  });

  it('counts against the real total, not against what it was sent', () => {
    // The API returns the first few matches per recording and the count of all of them; a group
    // that counted its own array would under-report every long interview.
    render(
      <ResultGroup
        title="Entrevista"
        matches={MATCHES.slice(0, 3)}
        total={41}
        onShowAll={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '+38 more in this recording' })).toBeDefined();
  });

  it('offers nothing more when there is nothing more', () => {
    render(<ResultGroup title="Nota de veu" matches={MATCHES.slice(0, 2)} />);
    expect(screen.queryByRole('button', { name: /more in this recording/ })).toBeNull();
  });

  it('opens the recording from its title', async () => {
    const onOpen = vi.fn();
    render(<ResultGroup title="Entrevista" matches={MATCHES} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole('button', { name: 'Entrevista' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('plays from a match without leaving the results', async () => {
    const onPlay = vi.fn();
    render(<ResultGroup title="Entrevista" matches={MATCHES} onPlay={onPlay} />);
    await userEvent.click(screen.getByText('La iaia hi estenia la roba.'));
    expect(onPlay).toHaveBeenCalledWith(MATCHES[1]);
  });

  it('leaves the lines inert when there is nothing to play', () => {
    // A read-only list of matches is not a list of buttons: a tab stop per line would make the
    // results unnavigable long before it made them usable.
    render(<ResultGroup title="Entrevista" matches={MATCHES} />);
    expect(screen.getByText('La iaia hi estenia la roba.').closest('[role="button"]')).toBeNull();
  });
});
