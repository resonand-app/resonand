/**
 * What lets the panel's growing edge uncover the labels instead of re-typesetting them (`UI-4c`).
 *
 * The rows are laid out at the settled width while the panel is still narrower than that, so only
 * the clip moves and each label is drawn once. When every row was instead as wide as the panel at
 * that instant, the library names ellipsised and un-ellipsised and the group headings wrapped to
 * two lines and back for the whole 200ms the width was in flight.
 *
 * jsdom lays nothing out and runs no transition, so neither the reveal nor the reflow it replaced
 * is visible here. The arrangement both rest on is, and that is the part a later edit would
 * quietly undo by moving the padding back onto the panel.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sidebar } from './Sidebar';

const OWN = [{ id: 'interviews', name: 'Interviews', colour: 'var(--library-clay)', count: 2 }];

/** The panel's content, which is the element whose width decides the two arrangements. */
function content(panel: HTMLElement): HTMLElement {
  const first = panel.firstElementChild;
  if (!(first instanceof HTMLElement)) throw new Error('The sidebar has no content element.');
  return first;
}

describe('Sidebar', () => {
  it('holds its rows at the settled width, behind a clip the panel carries', () => {
    render(<Sidebar own={OWN} />);
    const panel = screen.getByRole('navigation');
    expect(panel).toHaveStyle({ overflowX: 'clip' });
    expect(content(panel).style.width).toBe('var(--sidebar-width)');
  });

  it('lets its rows follow the panel once collapsed, so the icons stay centred', () => {
    render(<Sidebar own={OWN} collapsed />);
    expect(content(screen.getByRole('navigation')).style.width).toBe('100%');
  });
});
