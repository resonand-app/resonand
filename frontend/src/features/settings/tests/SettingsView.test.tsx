/**
 * V10's shell and its tabs (`UI-20a`, §V10).
 *
 * The claim under test is that Administration is a fact about the account and not a decoration:
 * present when `is_admin`, **absent** rather than disabled otherwise, and a link to it opened by
 * the wrong person landing on a real screen.
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

import { SettingsView } from '../SettingsView';
import { sectionIn } from '../sections';

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

describe('the sections', () => {
  it('is one destination with sections rather than a scattering of screens', async () => {
    show();
    expect(await screen.findByRole('tab', { name: 'Account' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Sessions' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Appearance' })).toBeVisible();
  });

  it('shows Administration only when the instance says you run it', async () => {
    archive.me = { ...archive.me, is_admin: true };
    show();
    expect(await screen.findByRole('tab', { name: 'Administration' })).toBeVisible();
  });

  it('leaves Administration out entirely rather than drawing it disabled', async () => {
    archive.me = { ...archive.me, is_admin: false };
    show();
    await screen.findByRole('tab', { name: 'Account' });
    expect(screen.queryByRole('tab', { name: 'Administration' })).toBeNull();
  });

  it('opens the section the address bar asks for, so a sessions link is a link', async () => {
    show(`${routes.settings}?section=sessions`);
    expect(await screen.findByRole('tab', { name: 'Sessions', selected: true })).toBeVisible();
  });

  it('moves between sections with the arrows, as one tab stop rather than four', async () => {
    show();
    await userEvent.click(await screen.findByRole('tab', { name: 'Account' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Sessions', selected: true })).toBeVisible();
  });
});

describe('which section a URL means', () => {
  it('falls back to Account for a section that does not exist', () => {
    expect(sectionIn('nonsense', true)).toBe('account');
    expect(sectionIn(null, true)).toBe('account');
  });

  it('lands somebody who is not an administrator on a real screen, not a blank one', () => {
    expect(sectionIn('administration', false)).toBe('account');
    expect(sectionIn('administration', true)).toBe('administration');
  });
});
