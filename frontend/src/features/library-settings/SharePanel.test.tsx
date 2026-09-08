/**
 * Who has access (`UI-17c`, §V7).
 *
 * Sharing is where the product's first promise is kept or broken, so what is tested here is the
 * wording as much as the wiring: the level says what it means in the API's own sentence, and
 * revoking says what the person loses before it happens.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { AVIA, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibrarySettingsView } from './LibrarySettingsView';

mockApi();

function show(uuid: string = AVIA) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[toLibrarySettings(uuid)]}>
        <Routes>
          <Route path={routes.librarySettings} element={<LibrarySettingsView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('giving somebody access', () => {
  it('asks nothing until a whole address has been typed, so it cannot be a directory', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/users/lookup') asked.push(url.searchParams.get('email') ?? '');
    });
    show();
    await userEvent.type(await screen.findByLabelText(/their email address/i), 'mar');
    expect(asked).toEqual([]);
    await userEvent.type(screen.getByLabelText(/their email address/i), 'ta@example.test');
    await waitFor(() => {
      expect(asked.at(-1)).toBe('marta@example.test');
    });
    // Only what is address-shaped is ever asked about. A name, or half of one, produces nothing:
    // there is no request that could tell somebody whether an account exists for a prefix.
    expect(asked.every((one) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(one))).toBe(true);
  });

  it('says it does not search for people, in as many words', async () => {
    show();
    expect(await screen.findByText(/does not search for people/i)).toBeVisible();
  });

  it('answers an address nobody has with a fact rather than with a list', async () => {
    show();
    await userEvent.type(
      await screen.findByLabelText(/their email address/i),
      'nobody@example.test',
    );
    expect(await screen.findByText('No account here has that address.')).toBeVisible();
  });

  it('grants at the level chosen, and only once the whole address matched', async () => {
    show(PERSONAL);
    await userEvent.type(
      await screen.findByLabelText(/their email address/i),
      'marta@example.test',
    );
    await userEvent.click(await screen.findByRole('button', { name: /Share with Marta/i }));
    await waitFor(() => {
      expect(archive.shares[PERSONAL]).toHaveLength(1);
    });
    expect(archive.shares[PERSONAL]?.[0]?.level).toBe(10);
  });

  it('does not offer to add somebody who is already there', async () => {
    show();
    await userEvent.type(
      await screen.findByLabelText(/their email address/i),
      'marta@example.test',
    );
    expect(await screen.findByText(/already has access/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /Share with Marta/i })).not.toBeInTheDocument();
  });
});

describe('the sharing panel', () => {
  it('names the person, their address, and when it was shared', async () => {
    show();
    expect(await screen.findByText('Marta')).toBeInTheDocument();
    expect(screen.getByText('marta@example.test')).toBeInTheDocument();
    expect(screen.getByText(/Shared by Gabriel/)).toBeInTheDocument();
  });

  it('renders the API’s own wording for a level rather than a copy of it', async () => {
    show();
    // The sentence lives beside the levels in the backend and arrives with the share.
    expect(
      await screen.findByText(/change titles, categories and tags, but not share/i),
    ).toBeVisible();
  });

  it('changes a level, which is the same grant', async () => {
    show();
    await userEvent.click(await screen.findByRole('radio', { name: /Can manage/i }));
    await waitFor(() => {
      expect(archive.shares[AVIA]?.[0]?.level).toBe(30);
    });
  });

  it('says what the person loses before revoking, in numbers', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Remove Marta/i }));
    expect(
      await screen.findByText(/loses access to all 3 recordings in Àvia Teresa/i),
    ).toBeVisible();
  });

  it('revokes only when the confirm is answered', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Remove Marta/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove their access' }));
    await waitFor(() => {
      expect(archive.shares[AVIA]).toHaveLength(0);
    });
  });

  it('states the promise as a fact when nobody has been given access', async () => {
    show(PERSONAL);
    expect(await screen.findByText('Only you can see this library.')).toBeVisible();
  });
});
