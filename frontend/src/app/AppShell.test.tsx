/**
 * The frame, filled (`UI-4c`, `UI-4d`, `UI-4e`, §2.2).
 *
 * What is worth testing here is the wiring, not the layout: which libraries land in which group,
 * what disappears when it is empty, and where a click goes. The geometry is `Shell`'s and is
 * already held by the design system's own tests.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ATENEU, AVIA, GABRIEL, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { AppShell } from './AppShell';
import { destinationOf, destinationTo, initialsOf } from './destinations';
import { routes, toLibrary } from './routes';

mockApi();

/**
 * A window wide enough for the sidebar to be out.
 *
 * jsdom is 1024 wide, which is below `--breakpoint-sidebar` -- so by default the sidebar these
 * tests are about is collapsed to icons and the libraries are hidden behind the Libraries
 * destination, exactly as §2.2 says they should be. Widening it is the setup, not a workaround.
 */
function wideEnough() {
  Object.defineProperty(window, 'innerWidth', { value: 1440, writable: true, configurable: true });
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderShell(at: string = routes.libraries) {
  wideEnough();
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Where />
        <Routes>
          <Route
            path="*"
            element={
              <AppShell>
                <div>the view</div>
              </AppShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('the sidebar', () => {
  it('shows the libraries you own, personal first', async () => {
    renderShell();
    const personal = await screen.findByText('Personal');
    const avia = screen.getByText('Àvia Teresa');
    // Personal is first because it is where a recording goes when nobody chose, not because of
    // how it happens to sort.
    expect(personal.compareDocumentPosition(avia)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('puts what somebody else owns in its own group', async () => {
    renderShell();
    expect(await screen.findByText('Reunions Ateneu')).toBeInTheDocument();
    expect(screen.getByText(/shared with you/i)).toBeInTheDocument();
  });

  it('drops the shared group entirely when nothing is shared', async () => {
    // An empty group is a standing reminder that nobody has shared anything with you, on every
    // screen (§2.2).
    server.use(
      http.get('/api/libraries', () =>
        HttpResponse.json(archive.libraries.filter((one) => one.owner.id === GABRIEL.id)),
      ),
    );
    renderShell();
    await screen.findByText('Personal');
    expect(screen.queryByText(/shared with you/i)).not.toBeInTheDocument();
  });

  it('counts what is in the trash, and says nothing when it is empty', async () => {
    renderShell();
    await screen.findByText('Personal');
    // The archive starts with an empty trash, so the entry is there without a number.
    expect(screen.getByText(/trash/i)).toBeInTheDocument();
  });

  it('goes where an entry points', async () => {
    renderShell();
    await userEvent.click(await screen.findByText('Àvia Teresa'));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(toLibrary(AVIA));
    });
  });
});

describe('which destination is lit', () => {
  it('is the library, on a library and on its settings', () => {
    expect(destinationOf(toLibrary(AVIA))).toBe(AVIA);
    expect(destinationOf(`${toLibrary(AVIA)}/settings`)).toBe(AVIA);
  });

  it('is nothing on a recording, which belongs to a library the URL does not name', () => {
    expect(destinationOf('/recording/abc')).toBe('');
  });

  it('maps the three fixed entries to their routes and a uuid to its library', () => {
    expect(destinationTo('libraries')).toBe(routes.libraries);
    expect(destinationTo('trash')).toBe(routes.trash);
    expect(destinationTo('settings')).toBe(routes.settings);
    expect(destinationTo(PERSONAL)).toBe(toLibrary(PERSONAL));
  });
});

describe('the top nav', () => {
  it('takes a search to the search view, where the query lives in the URL', async () => {
    renderShell();
    const field = await screen.findByPlaceholderText('Search everything');
    await userEvent.type(field, 'vermut');
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('q=vermut');
    });
  });

  it('identifies the account by initials, because there are no avatar images anywhere', () => {
    expect(initialsOf('Gabriel Costa')).toBe('GC');
    expect(initialsOf('Gabriel')).toBe('G');
    expect(initialsOf(undefined)).toBe('');
  });
});

describe('a library shared with you', () => {
  it('is reachable, and is not in the group of the ones you own', async () => {
    renderShell(toLibrary(ATENEU));
    expect(await screen.findByText('Reunions Ateneu')).toBeInTheDocument();
    expect(destinationOf(toLibrary(ATENEU))).toBe(ATENEU);
  });
});

describe('the keyboard', () => {
  it('focuses the search field from anywhere on the page', async () => {
    // §1.8's one chord and its one-key alternative, answered by the shell because the field it
    // focuses belongs to the shell.
    renderShell();
    const field = await screen.findByPlaceholderText('Search everything');
    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(field).toHaveFocus();
  });

  it('answers the slash too, from a page that is not a field', async () => {
    renderShell();
    const field = await screen.findByPlaceholderText('Search everything');
    field.blur();
    await userEvent.keyboard('/');
    expect(field).toHaveFocus();
  });
});
