/**
 * V10 · Sessions (`UI-20c`, §V10).
 *
 * The three states the specification names, and the reason each one is drawn the way it is:
 * the current session is not revocable by mistake, "sign out everywhere else" is absent when
 * there is nowhere else, and an unrecognised device shows its raw string rather than a guess.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { SessionsPanel } from './SessionsPanel';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <SessionsPanel />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('where you are signed in', () => {
  it('lists every sign-in the account has', async () => {
    show();
    expect(await screen.findByText('Firefox on Linux')).toBeVisible();
    expect(screen.getByText(/iPhone; CPU iPhone OS/)).toBeVisible();
  });

  it('marks this device and gives it no button to press by mistake', async () => {
    show();
    expect(await screen.findByText('This device')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Sign out Firefox on Linux' })).toBeNull();
  });

  it('shows an unrecognised device as it is, rather than guessing at it', async () => {
    show();
    expect(await screen.findByText('Unrecognised device')).toBeVisible();
  });

  it('signs one device out', async () => {
    show();
    await userEvent.click(
      await screen.findByRole('button', { name: /Sign out Mozilla\/5\.0 \(iPhone/ }),
    );
    await waitFor(() => {
      expect(archive.sessions.some((one) => one.id === 2)).toBe(false);
    });
  });
});

describe('signing out everywhere else', () => {
  it('says how many sign-ins end, and leaves this one alone', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out everywhere else' }));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText(/2 other sign-ins end/)).toBeVisible();
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Sign out everywhere else' }),
    );
    await waitFor(() => {
      expect(archive.sessions).toHaveLength(1);
    });
    expect(archive.sessions[0]?.is_current).toBe(true);
  });

  it('is absent rather than disabled when there is nowhere else to sign out of', async () => {
    archive.sessions = archive.sessions.filter((one) => one.is_current);
    show();
    await screen.findByText('This device');
    expect(screen.queryByRole('button', { name: 'Sign out everywhere else' })).toBeNull();
  });
});

describe('when the list cannot be read', () => {
  it('says so and offers the way back, rather than showing an empty list', async () => {
    server.use(
      http.get('/api/auth/sessions', () =>
        HttpResponse.json(
          {
            type: '/errors/error',
            title: 'Error',
            detail: 'The instance answered 500 and said nothing more.',
            status: 500,
            request_id: 'test-request',
          },
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    expect(await screen.findByText('Your sign-ins could not be read.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
  });
});
