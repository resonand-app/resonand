/**
 * Administration's own chrome (`INT-3a`, §V10).
 *
 * The claim is that it does not read as the fourth paragraph of a settings page: it says what it
 * is, and it is reached deliberately rather than by scrolling.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { SettingsView } from '@/features/settings/SettingsView';

mockApi();

function show(at: string = routes.settings) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path={routes.settings} element={<SettingsView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('running the instance', () => {
  it('says whose settings these are, rather than warning about them', async () => {
    archive.me = { ...archive.me, is_admin: true };
    show(`${routes.settings}?section=administration`);
    expect(await screen.findByRole('heading', { name: 'This instance' })).toBeVisible();
    expect(
      screen.getByText(/belong to the whole instance and to everybody with an account on it/),
    ).toBeVisible();
  });

  it('is not on screen until somebody chooses it', async () => {
    archive.me = { ...archive.me, is_admin: true };
    show();
    await screen.findByRole('tab', { name: 'Administration' });
    expect(screen.queryByRole('heading', { name: 'This instance' })).toBeNull();
    await userEvent.click(screen.getByRole('tab', { name: 'Administration' }));
    expect(await screen.findByRole('heading', { name: 'This instance' })).toBeVisible();
  });

  it('cannot be reached at all by somebody who does not run it', async () => {
    archive.me = { ...archive.me, is_admin: false };
    show(`${routes.settings}?section=administration`);
    await screen.findByRole('tab', { name: 'Account' });
    expect(screen.queryByRole('heading', { name: 'This instance' })).toBeNull();
  });
});
