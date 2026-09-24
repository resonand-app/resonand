/**
 * The frame, filled (`UI-4c`, `UI-4d`, `UI-4e`, §2.2).
 *
 * What is worth testing here is the wiring, not the layout: which libraries land in which group,
 * what disappears when it is empty, and where a click goes. The geometry is `Shell`'s and is
 * already held by the design system's own tests.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { CASSETTE, MEETINGS, RECORDINGS, ALEX, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { AppShell } from '../AppShell';
import { destinationOf, destinationTo, initialsOf } from '@/app/destinations';
import { routes, toLibrary } from '@/app/routes';

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
      {/* The account menu reads the theme, which the entry point provides in the application. */}
      <ThemeProvider>
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
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the sidebar', () => {
  it('shows the libraries you own, personal first', async () => {
    renderShell();
    const personal = await screen.findByText('Personal');
    const avia = screen.getByText('Field recordings');
    // Personal is first because it is where a recording goes when nobody chose, not because of
    // how it happens to sort.
    expect(personal.compareDocumentPosition(avia)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('puts what somebody else owns in its own group', async () => {
    renderShell();
    expect(await screen.findByText('Meetings')).toBeInTheDocument();
    expect(screen.getByText(/shared with you/i)).toBeInTheDocument();
  });

  it('drops the shared group entirely when nothing is shared', async () => {
    // An empty group is a standing reminder that nobody has shared anything with you, on every
    // screen (§2.2).
    server.use(
      http.get('/api/libraries', () =>
        HttpResponse.json(archive.libraries.filter((one) => one.owner.id === ALEX.id)),
      ),
    );
    renderShell();
    await screen.findByText('Personal');
    expect(screen.queryByText(/shared with you/i)).not.toBeInTheDocument();
  });

  it('says nothing on the trash entry when there is nothing in it', async () => {
    renderShell();
    await screen.findByText('Personal');
    // The entry is there whether or not there is anything in it, and an exact name is what says
    // there is no number beside it.
    expect(screen.getByRole('button', { name: 'Trash' })).toBeInTheDocument();
  });

  it('counts the libraries in the trash as well as the recordings', async () => {
    // Both are things somebody put there and both are rows they will come looking for, so the
    // badge is the sum -- the same one the trash screen itself arrives at.
    const when = new Date().toISOString();
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === RECORDINGS ? { ...one, deleted_at: when } : one,
    );
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CASSETTE ? { ...one, deleted_at: when } : one,
    );
    renderShell();
    const trash = await screen.findByRole('button', { name: /^Trash/ });
    await waitFor(() => {
      expect(within(trash).getByText('2')).toBeInTheDocument();
    });
  });

  it('goes where an entry points', async () => {
    renderShell();
    await userEvent.click(await screen.findByText('Field recordings'));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(toLibrary(RECORDINGS));
    });
  });
});

describe('which destination is lit', () => {
  it('is the library, on a library and on its settings', () => {
    expect(destinationOf(toLibrary(RECORDINGS))).toBe(RECORDINGS);
    expect(destinationOf(`${toLibrary(RECORDINGS)}/settings`)).toBe(RECORDINGS);
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
  it('offers the quick hits while it is typed into, and goes nowhere yet (`UI-16a`)', async () => {
    // A keystroke is not a navigation: typing opens the dropdown and the address stays where it
    // was, because a history entry per letter is a back button nobody can use.
    renderShell();
    const field = await screen.findByPlaceholderText('Search everything');
    await userEvent.type(field, 'Cassette');
    // One recording in the archive is called that, and the see-all row counts honestly rather
    // than saying "results" over a single one.
    expect(await screen.findByText(/all 1 result for/i)).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(routes.libraries);
    expect(screen.getByTestId('where')).not.toHaveTextContent('q=');
  });

  it('leaves for the full results on Enter, carrying the query (`UI-16a`)', async () => {
    renderShell();
    const field = await screen.findByPlaceholderText('Search everything');
    await userEvent.type(field, 'Cassette{Enter}');
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent('q=Cassette');
    });
  });

  it('identifies the account by initials, because there are no avatar images anywhere', () => {
    expect(initialsOf('Alex Morgan')).toBe('AM');
    expect(initialsOf('Alex')).toBe('A');
    expect(initialsOf(undefined)).toBe('');
  });
});

describe('a library shared with you', () => {
  it('is reachable, and is not in the group of the ones you own', async () => {
    renderShell(toLibrary(MEETINGS));
    expect(await screen.findByText('Meetings')).toBeInTheDocument();
    expect(destinationOf(toLibrary(MEETINGS))).toBe(MEETINGS);
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

describe('the account menu', () => {
  it('opens from the avatar, and says who is signed in', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Your account' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Alex Morgan')).toBeInTheDocument();
    expect(within(menu).getByText('alex@example.test')).toBeInTheDocument();
  });

  it('carries the theme, Settings and sign out, and nothing else', async () => {
    // Everything else about an account is V10. A menu that grew a third of the settings view
    // would be two places to change one thing.
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Your account' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByText('Theme')).toBeInTheDocument();
    expect(within(menu).getByText('Settings')).toBeInTheDocument();
    expect(within(menu).getByText('Sign out')).toBeInTheDocument();
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3);
    expect(within(menu).queryAllByRole('button')).toHaveLength(0);
  });

  it('goes to Settings and closes on the way', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Your account' }));
    // Scoped to the menu: "Settings" is a sidebar destination too, which is the point of both.
    const menu = await screen.findByRole('menu');
    await userEvent.click(within(menu).getByText('Settings'));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(routes.settings);
    });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('names its layer, so it draws over the view rather than under it', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Your account' }));
    const menu = await screen.findByRole('menu');
    // jsdom has no stacking, so it cannot see the menu paint behind the page. It can hold the
    // cause: an overlay naming no layer stacks by DOM order, under the `<main>` after it.
    expect(menu.style.zIndex).toBe('var(--z-menu)');
  });

  it('closes on Escape, like every other overlay in the product', async () => {
    renderShell();
    await userEvent.click(await screen.findByRole('button', { name: 'Your account' }));
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });
});

describe('the lockup', () => {
  it('is the way back to the libraries, and gets there without leaving the router', async () => {
    renderShell(toLibrary(RECORDINGS));
    const home = await screen.findByRole('link', { name: /back to your libraries/ });
    expect(home).toHaveAttribute('href', routes.libraries);
    await userEvent.click(home);
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(routes.libraries);
    });
  });
});

describe('the search field', () => {
  it('takes a click anywhere in the box, not only on the input', async () => {
    // jsdom has no pseudo-elements, so it cannot reproduce the `::after` that intercepts the
    // click. It can hold the arrangement that survives it: a label wrapping its own input.
    renderShell();
    const field = await screen.findByRole('textbox', { name: 'Search everything' });
    const box = field.closest('label');
    expect(box).not.toBeNull();
    expect(box).toHaveAttribute('data-ds', 'search-field');
    await userEvent.click(box as HTMLElement);
    expect(field).toHaveFocus();
  });
});
