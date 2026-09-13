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
import { HttpResponse, http } from 'msw';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { ATENEU, AVIA, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibrariesView } from '../LibrariesView';

mockApi();

/** Where the router thinks it is, for the tests about opening a library. */
function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

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

  it('draws no waveform: the shape of one recording is not a fact about the library', async () => {
    renderView();
    const card = await cardFor('Àvia Teresa');
    expect(card.querySelector('[data-ds="waveform"]')).toBeNull();
  });

  it('is drawn entirely from the list request, and asks for nothing of its own', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderView();
    await cardFor('Àvia Teresa');
    await cardFor('Personal');
    // Neither of the two the waveform cost: which recording is the most recent, then its peaks.
    expect(asked.some((url) => url.includes(`/libraries/${AVIA}/audio`))).toBe(false);
    expect(asked.some((url) => url.includes(`/libraries/${PERSONAL}/audio`))).toBe(false);
    expect(asked.some((url) => url.includes('/waveform'))).toBe(false);
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

describe('the states', () => {
  it('draws skeletons that match the layout rather than a spinner', () => {
    renderView();
    // The page knows its own shape, so it says so while it waits: three card-shaped blocks, and
    // the create tile already solid beside them.
    expect(document.querySelectorAll('[data-ds="card-skeleton"]')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Create a library/ })).toBeInTheDocument();
  });

  it('meets a brand-new account with an invitation rather than an empty grid', async () => {
    archive.libraries = archive.libraries
      .filter((one) => one.uuid === PERSONAL)
      .map((one) => ({ ...one, audio_count: 0, total_duration_ms: 0 }));
    renderView();
    expect(await screen.findByText(/Nothing in here yet/)).toBeInTheDocument();
    // The personal library is still there. It is where the audio will land.
    expect(screen.getByRole('heading', { name: 'Personal' })).toBeInTheDocument();
  });

  it('leaves the invitation alone once there is anything at all', async () => {
    renderView();
    await screen.findByRole('heading', { name: 'Personal' });
    expect(screen.queryByText(/Nothing in here yet/)).toBeNull();
  });

  it("shows the problem document's own words, because they were written to be read", async () => {
    server.use(
      http.get('/api/libraries', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Internal Server Error',
            detail: 'The database is locked. It usually clears within a minute.',
            status: 500,
          },
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderView();
    expect(
      await screen.findByText('The database is locked. It usually clears within a minute.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('says the instance is not there rather than that something did not work', async () => {
    server.use(http.get('/api/libraries', () => HttpResponse.error()));
    renderView();
    // A different sentence from an error on purpose: "that did not work" sends somebody looking
    // for a bug in their archive when the machine is simply not answering.
    expect(await screen.findByText(/The instance is not answering/)).toBeInTheDocument();
    expect(screen.getByText(/could not be reached/)).toBeInTheDocument();
  });
});

describe('creating a library', () => {
  it('opens the dialog from the create tile', async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole('button', { name: /Create a library/ }));
    expect(await screen.findByRole('dialog', { name: 'Create a library' })).toBeInTheDocument();
  });
});

describe('opening a library', () => {
  /** The grid, with somewhere to read the address off. */
  function renderWithLocation() {
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    return render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <MemoryRouter>
            <Where />
            <LibrariesView />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    );
  }

  it('opens from the whole card and not only from the title', async () => {
    const user = userEvent.setup();
    renderWithLocation();
    const card = await cardFor('Personal');
    // The meta line: a part of the card that is not the link.
    await user.click(within(card).getByText(/recordings ·/));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(toLibrary(PERSONAL));
    });
  });

  it('keeps the title a link, and answers it in the router rather than reloading', async () => {
    const user = userEvent.setup();
    renderWithLocation();
    const card = await cardFor('Personal');
    const title = within(card).getByRole('link', { name: 'Personal' });
    expect(title).toHaveAttribute('href', toLibrary(PERSONAL));
    await user.click(title);
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(toLibrary(PERSONAL));
    });
  });

  it('does not open the library when the overflow control is pressed', async () => {
    const user = userEvent.setup();
    renderWithLocation();
    const card = await cardFor('Personal');
    await user.click(within(card).getByRole('button', { name: 'Options for Personal' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    expect(screen.getByTestId('where')).not.toHaveTextContent(toLibrary(PERSONAL));
  });
});
