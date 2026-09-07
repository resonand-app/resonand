/**
 * V2, the grid and the title block (`UI-31a`, §V2).
 *
 * What is worth asserting here is the arithmetic and the order: the counts are the archive's own
 * and are not rounded, and the create tile is first whether or not anything has loaded. The card
 * geometry is `LibraryCard`'s and the grid's tracks are one CSS declaration -- neither is a thing
 * a jsdom test can see, and both are already held by the design system.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { mockApi } from '@/test/api/server';

import { LibrariesView } from './LibrariesView';

mockApi();

function renderView() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <LibrariesView />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** The grid the create tile sits in, which is the half of the screen this task draws. */
function gridOf(): HTMLElement {
  const grid = screen.getByRole('button', { name: /Create a library/ }).parentElement;
  if (grid === null) throw new Error('The create tile is not inside a grid.');
  return grid;
}

describe('the title block', () => {
  it('counts the whole archive, including what somebody else shared', async () => {
    renderView();
    // 84 + 3 + 41 across the three fixture libraries. The shared one counts: the number answers
    // what this account can listen to.
    expect(await screen.findByText(/128 recordings/)).toBeInTheDocument();
  });

  it('states the total duration in full rather than rounding it', async () => {
    renderView();
    // 31 h 12 + 2 h 04 + 9 h 18 = 42 h 34, written out, never "~43 h".
    const meta = await screen.findByText(/128 recordings/);
    expect(meta.textContent).toMatch(/42.h.34.min/u);
  });
});

describe('the grid', () => {
  it('puts the create tile before every library', async () => {
    renderView();
    const create = await screen.findByRole('button', { name: /Create a library/ });
    const personal = await screen.findByRole('heading', { name: 'Personal' });
    expect(create.compareDocumentPosition(personal)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('draws the create tile before the libraries have arrived', () => {
    renderView();
    // No `find`: it is on screen in the first paint, because it needs nothing from the API.
    expect(screen.getByRole('button', { name: /Create a library/ })).toBeInTheDocument();
  });

  it('shows the libraries this account owns, personal first', async () => {
    renderView();
    const personal = await screen.findByRole('heading', { name: 'Personal' });
    const avia = screen.getByRole('heading', { name: 'Àvia Teresa' });
    expect(personal.compareDocumentPosition(avia)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('leaves what somebody else owns out of this grid', async () => {
    renderView();
    await screen.findByRole('heading', { name: 'Personal' });
    // `Reunions Ateneu` is Marta's. It has a group of its own (`UI-31c`) and is not one of these.
    expect(within(gridOf()).queryByText('Reunions Ateneu')).toBeNull();
  });
});
