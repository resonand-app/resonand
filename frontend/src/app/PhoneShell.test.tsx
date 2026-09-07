/**
 * The phone frame (`UI-4f`, `DEC-23`, §2.3).
 *
 * What is tested is what makes it not a narrowed desktop: four bottom tabs, three controls that
 * are deliberately absent, and an upload that is a tab without being a route.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { mockApi } from '@/test/api/server';

import { AppShell } from './AppShell';
import { PHONE_BREAKPOINT } from './use-is-phone';
import { routes, toLibrary } from './routes';
import { tabOf } from './tabs';

mockApi();

function widthOf(pixels: number) {
  Object.defineProperty(window, 'innerWidth', {
    value: pixels,
    writable: true,
    configurable: true,
  });
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderPhone(at: string = routes.libraries) {
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
              <AppShell tray={<div>the upload panel</div>}>
                <div>the view</div>
              </AppShell>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  widthOf(390);
});

describe('below the phone breakpoint', () => {
  it('replaces the desktop frame rather than narrowing it', async () => {
    renderPhone();
    expect(await screen.findByText('the view')).toBeInTheDocument();
    // The three controls §2.3 says do not exist here.
    expect(screen.queryByPlaceholderText(/search everything/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload recordings/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /show or hide the sidebar/i }),
    ).not.toBeInTheDocument();
  });

  it('puts four destinations at the bottom, where the thumb is', async () => {
    renderPhone();
    const tabs = await screen.findByRole('navigation', { name: 'Main' });
    for (const name of ['Libraries', 'Search', 'Upload', 'Settings']) {
      expect(within(tabs).getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('goes to a destination when its tab is pressed', async () => {
    renderPhone();
    const tabs = await screen.findByRole('navigation', { name: 'Main' });
    await userEvent.click(within(tabs).getByRole('button', { name: 'Settings' }));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(routes.settings);
    });
  });

  it('shows upload without changing the address, so navigating cannot abort one', async () => {
    // §2.1 gives upload no route and §2.3 makes it a tab. Both, and this is how: the panel is
    // over the view, the URL does not move, and the browser's back button is not an abort button.
    renderPhone();
    const bar = await screen.findByRole('navigation', { name: 'Main' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Upload' }));
    expect(screen.getByText('the upload panel')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent(routes.libraries);
  });

  it('lights the tab a screen belongs to', () => {
    // A library, a recording and the trash are all inside Libraries: a bar that lit nothing on
    // two thirds of the screens would be a bar nobody reads.
    expect(tabOf(routes.libraries)).toBe('libraries');
    expect(tabOf(toLibrary('x'))).toBe('libraries');
    expect(tabOf('/recording/x')).toBe('libraries');
    expect(tabOf(routes.trash)).toBe('libraries');
    expect(tabOf(routes.search)).toBe('search');
    expect(tabOf(routes.settings)).toBe('settings');
  });
});

describe('above it', () => {
  it('is the desktop frame, with the controls the phone does not have', async () => {
    widthOf(PHONE_BREAKPOINT + 800);
    renderPhone();
    expect(await screen.findByPlaceholderText('Search everything')).toBeInTheDocument();
    // "Libraries" is a word in both shells -- the sidebar has a destination by that name -- so
    // what is asserted is the tab bar itself, which the desktop does not have.
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });
});
