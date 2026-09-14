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
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { RECORDINGS, PERSONAL, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibrarySettingsView } from '../LibrarySettingsView';

mockApi();

function show(uuid: string = RECORDINGS) {
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

describe('the three variants', () => {
  it('keeps the panel and drops the controls when you can edit but not manage', async () => {
    server.use(
      http.get('/api/libraries/:library_uuid', ({ params }) =>
        HttpResponse.json({
          ...archive.libraries.find((one) => one.uuid === params.library_uuid),
          level: 20,
        }),
      ),
    );
    show();
    // Read-only rather than absent: seeing who else has access is part of knowing what you are
    // working in.
    expect(await screen.findByText('Sam Rivera')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove Sam Rivera/i })).not.toBeInTheDocument();
    expect(screen.getByText(/only somebody who can manage it/i)).toBeVisible();
  });

  it('cannot share the personal library away, and says why once', async () => {
    show(PERSONAL);
    expect(await screen.findByText(/personal library cannot be shared/i)).toBeVisible();
    expect(screen.queryByLabelText(/their email address/i)).not.toBeInTheDocument();
  });

  it('says which half of the answer it is showing, since a moved recording carries its own', async () => {
    show();
    expect(await screen.findByText(/can carry access of its own/i)).toBeVisible();
  });
});

describe('giving somebody access', () => {
  it('asks nothing until a whole address has been typed, so it cannot be a directory', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => {
      const url = new URL(request.url);
      if (url.pathname === '/api/users/lookup') asked.push(url.searchParams.get('email') ?? '');
    });
    show();
    await userEvent.type(await screen.findByLabelText(/their email address/i), 'sa');
    expect(asked).toEqual([]);
    await userEvent.type(screen.getByLabelText(/their email address/i), 'm@example.test');
    await waitFor(() => {
      expect(asked.at(-1)).toBe('sam@example.test');
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
    // A library nobody has been given access to yet, which is what the add form is for. The
    // personal one has no form at all, and that is `UI-17e`'s business rather than this test's.
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    show();
    await userEvent.type(await screen.findByLabelText(/their email address/i), 'sam@example.test');
    await userEvent.click(await screen.findByRole('button', { name: /Share with Sam Rivera/i }));
    await waitFor(() => {
      expect(archive.shares[RECORDINGS]).toHaveLength(1);
    });
    expect(archive.shares[RECORDINGS]?.[0]?.level).toBe(10);
  });

  it('does not offer to add somebody who is already there', async () => {
    show();
    await userEvent.type(await screen.findByLabelText(/their email address/i), 'sam@example.test');
    expect(await screen.findByText(/already has access/i)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Share with Sam Rivera/i }),
    ).not.toBeInTheDocument();
  });
});

describe('the sharing panel', () => {
  it('names the person, their address, and when it was shared', async () => {
    show();
    expect(await screen.findByText('Sam Rivera')).toBeInTheDocument();
    expect(screen.getByText('sam@example.test')).toBeInTheDocument();
    expect(screen.getByText(/Shared by Alex Morgan/)).toBeInTheDocument();
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
      expect(archive.shares[RECORDINGS]?.[0]?.level).toBe(30);
    });
  });

  it('says what the person loses before revoking, in numbers', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Remove Sam Rivera/i }));
    expect(
      await screen.findByText(/loses access to all 3 recordings in Field recordings/i),
    ).toBeVisible();
  });

  it('revokes only when the confirm is answered', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Remove Sam Rivera/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Remove their access' }));
    await waitFor(() => {
      expect(archive.shares[RECORDINGS]).toHaveLength(0);
    });
  });

  it('states the promise as a fact when nobody has been given access', async () => {
    show(PERSONAL);
    expect(await screen.findByText('Only you can see this library.')).toBeVisible();
  });
});
