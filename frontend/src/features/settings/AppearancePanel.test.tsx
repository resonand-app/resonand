/**
 * V10 · Appearance (`UI-20d`, §V10).
 *
 * Two controls stored in two places, which is the claim: the theme is a property of the screen
 * and stays on the device, the language is a property of the person and saves to the account.
 * And the language control is a working round trip with one option -- which is the point of
 * shipping it now rather than alongside the first translation.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { AppearancePanel } from './AppearancePanel';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <AppearancePanel />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the theme', () => {
  it('offers light, dark and following the system, and nothing else', async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'Theme' }));
    expect(screen.getByRole('option', { name: 'Light' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Dark' })).toBeVisible();
    expect(screen.getByRole('option', { name: 'Follow the system' })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('takes effect on the document and tells the account nothing about it', async () => {
    // Where it is stored is the design system's own business and its own test. What V10 owes is
    // that choosing a theme changes this screen and makes no request: an account that carried a
    // theme could only ever be wrong for one of somebody's two devices.
    const before = { ...archive.me };
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'Theme' }));
    await userEvent.click(screen.getByRole('option', { name: 'Light' }));
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('light');
    });
    expect(archive.me).toEqual(before);
  });

  it('says where it is stored, because that is why it is not on the account', async () => {
    show();
    expect(await screen.findByText(/Saved on this device/i)).toBeVisible();
  });
});

describe('the language', () => {
  it('is a working control with one option, drawn as settled rather than unfinished', async () => {
    show();
    expect(
      await screen.findByText(/English is the only language this version speaks/i),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('combobox', { name: 'Language' }));
    expect(screen.getByRole('option', { name: 'English' })).toBeVisible();
  });

  it('saves against the account, which is the round trip it exists to prove', async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'Language' }));
    await userEvent.click(screen.getByRole('option', { name: 'English' }));
    await waitFor(() => {
      expect(archive.me.language).toBe('en');
    });
  });
});
