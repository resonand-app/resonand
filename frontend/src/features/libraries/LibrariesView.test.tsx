/**
 * V2, the grid and the title block (`UI-31a`, §V2).
 *
 * What is worth asserting here is the arithmetic and the order: the counts are the archive's own
 * and are not rounded, and the create tile is first whether or not anything has loaded. The card
 * geometry is `LibraryCard`'s and the grid's tracks are one CSS declaration -- neither is a thing
 * a jsdom test can see, and both are already held by the design system.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { ATENEU, AVIA, NOTA, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

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

/** One card, found by the library it is about. */
async function cardFor(name: string): Promise<HTMLElement> {
  const heading = await screen.findByRole('heading', { name });
  const card = heading.closest('article');
  if (card === null) throw new Error(`The card for ${name} is not an article.`);
  return card;
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

describe('a card', () => {
  it('carries the name, the count and the total, all from one list request', async () => {
    renderView();
    const card = await cardFor('Àvia Teresa');
    expect(within(card).getByText(/3 recordings/)).toBeInTheDocument();
    expect(within(card).getByText(/2.h.04.min/u)).toBeInTheDocument();
  });

  it('opens the library from the title, by keyboard', async () => {
    renderView();
    const card = await cardFor('Àvia Teresa');
    // A link, so it is in the tab order, announced as a link, and openable in a new tab. The
    // click handler over the whole card is the mouse convenience, not the affordance.
    expect(within(card).getByRole('link', { name: 'Àvia Teresa' })).toHaveAttribute(
      'href',
      `/library/${AVIA}`,
    );
  });

  it('names the overflow control after the library it belongs to', async () => {
    renderView();
    const card = await cardFor('Àvia Teresa');
    expect(within(card).getByRole('button', { name: 'Options for Àvia Teresa' })).toBeVisible();
  });

  it('draws no waveform until one has been fetched, and never an invented one', async () => {
    renderView();
    const card = await cardFor('Àvia Teresa');
    // `pending` while the two deferred requests are in flight: a dashed rule, not a shape.
    expect(card.querySelector('[data-ds="waveform"]')).toBeNull();
    await waitFor(() => {
      expect(card.querySelector('[data-ds="waveform"]')).not.toBeNull();
    });
  });

  it('asks for nothing at all for a library with no recordings', async () => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === AVIA ? { ...one, audio_count: 0, total_duration_ms: 0 } : one,
    );
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderView();
    await cardFor('Àvia Teresa');
    // The personal library still asks, which is what makes the absence below a decision rather
    // than a page that never got as far as fetching anything.
    await waitFor(() => {
      expect(asked.some((url) => url.includes(`/libraries/${PERSONAL}/audio`))).toBe(true);
    });
    // `audio_count` already answers "is there a most recent recording", so it is not asked.
    expect(asked.some((url) => url.includes(`/libraries/${AVIA}/audio`))).toBe(false);
  });

  it('asks for no peaks for a recording whose waveform job has not run', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderView();
    await cardFor('Personal');
    // The most recent thing in the personal library is a voice note still being processed, and
    // `has_waveform` says so on the summary -- so the request that would 404 is never made.
    await waitFor(() => {
      expect(asked.some((url) => url.includes(`/libraries/${PERSONAL}/audio`))).toBe(true);
    });
    expect(asked.some((url) => url.includes(`/audio/${NOTA}/waveform`))).toBe(false);
  });
});

describe('the shared group', () => {
  it('is titled separately and holds what somebody else owns', async () => {
    renderView();
    const group = await screen.findByRole('heading', { name: /Shared with you/i });
    const ateneu = await screen.findByRole('heading', { name: 'Reunions Ateneu' });
    expect(group.compareDocumentPosition(ateneu)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('names the owner and what you may do there', async () => {
    renderView();
    const card = await cardFor('Reunions Ateneu');
    // Level 20 in the fixtures. The short name, not the API's whole sentence -- that one is for
    // the sharing panel, where somebody is deciding what to grant.
    expect(within(card).getByText('Marta · Can edit')).toBeInTheDocument();
  });

  it('is absent entirely when nobody has shared anything', async () => {
    archive.libraries = archive.libraries.filter((one) => one.uuid !== ATENEU);
    renderView();
    await screen.findByRole('heading', { name: 'Personal' });
    // Absent, not empty: a group saying nobody has shared anything with you is a thing to read
    // every time somebody opens the home page.
    expect(screen.queryByRole('heading', { name: /Shared with you/i })).toBeNull();
  });
});
