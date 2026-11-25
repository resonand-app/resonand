/**
 * Who has access (`UI-17c`, §V7).
 *
 * Sharing is where the product's first promise is kept or broken, so what is tested here is the
 * wording as much as the wiring: the level says what it means in the API's own sentence, and
 * revoking says what the person loses before it happens.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { RECORDINGS, PERSONAL, ROBIN, SAM, archive } from '@/test/api/archive';
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
  it('is not reached at all when you can edit but not manage', async () => {
    server.use(
      http.get('/api/libraries/:library_uuid', ({ params }) =>
        HttpResponse.json({
          ...archive.libraries.find((one) => one.uuid === params.library_uuid),
          level: 20,
        }),
      ),
    );
    show();
    // The route takes level 30, so who else has access is answered by the library's own header
    // and its avatar stack rather than by a panel behind a screen full of read-only fields.
    expect(await screen.findByText(/need Can manage/i)).toBeVisible();
    expect(screen.queryByText('Sam Rivera')).not.toBeInTheDocument();
  });

  it('cannot share the personal library away, and says why once', async () => {
    show(PERSONAL);
    expect(await screen.findByText(/personal library cannot be shared/i)).toBeVisible();
    expect(screen.queryByRole('group', { name: /who to share with/i })).not.toBeInTheDocument();
  });

  it('says which half of the answer it is showing, since a moved recording carries its own', async () => {
    show();
    expect(await screen.findByText(/can carry access of its own/i)).toBeVisible();
  });
});

describe('giving somebody access', () => {
  it('offers the people on the instance as a choice, by name', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    show();
    const group = await screen.findByRole('group', { name: /who to share with/i });
    expect(
      within(group)
        .getAllByRole('checkbox')
        .map((one) => one.textContent),
    ).toEqual(['RORobin Okafor', 'SRSam Rivera']);
  });

  it('leaves out whoever already has access, since they are listed above with their level', async () => {
    show();
    const group = await screen.findByRole('group', { name: /who to share with/i });
    expect(within(group).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(group).queryByRole('checkbox', { name: /Sam Rivera/ })).not.toBeInTheDocument();
  });

  it('shares nothing until a level is confirmed, then grants at the level chosen', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    show();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Robin Okafor/ }));
    expect(archive.shares[RECORDINGS]).toHaveLength(0);
    const levels = screen.getByRole('radiogroup', { name: /What Robin Okafor will be able to do/ });
    await userEvent.click(within(levels).getByRole('radio', { name: /Can edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /Share with Robin Okafor/i }));
    await waitFor(() => {
      expect(archive.shares[RECORDINGS]).toHaveLength(1);
    });
    expect(archive.shares[RECORDINGS]?.[0]?.grantee.id).toBe(3);
    expect(archive.shares[RECORDINGS]?.[0]?.level).toBe(20);
  });

  it('shares with everybody chosen at once, at the one level chosen', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    show();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Robin Okafor/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Sam Rivera/ }));
    const levels = screen.getByRole('radiogroup', {
      name: /What these 2 people will be able to do/,
    });
    await userEvent.click(within(levels).getByRole('radio', { name: /Can manage/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Share with 2 people' }));
    await waitFor(() => {
      expect(archive.shares[RECORDINGS]).toHaveLength(2);
    });
    expect(archive.shares[RECORDINGS]?.map((one) => [one.grantee.id, one.level])).toEqual([
      [ROBIN.id, 30],
      [SAM.id, 30],
    ]);
    expect(
      await screen.findByText(/everybody with an account here already has access/i),
    ).toBeVisible();
  });

  it('keeps whoever a grant was refused for chosen, and lets the others through', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    server.use(
      http.put('/api/libraries/:library_uuid/shares', async ({ request }) => {
        const body = (await request.clone().json()) as { grantee_id: number };
        if (body.grantee_id !== SAM.id) return undefined;
        return HttpResponse.json(
          { title: 'Refused', status: 409, detail: 'Sam Rivera cannot be given access.' },
          { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
        );
      }),
    );
    show();
    await userEvent.click(await screen.findByRole('checkbox', { name: /Robin Okafor/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Sam Rivera/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Share with 2 people' }));
    await waitFor(() => {
      expect(archive.shares[RECORDINGS]).toHaveLength(1);
    });
    const group = await screen.findByRole('group', { name: /who to share with/i });
    await waitFor(() => {
      expect(within(group).getAllByRole('checkbox')).toHaveLength(1);
    });
    expect(within(group).getByRole('checkbox', { name: /Sam Rivera/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('button', { name: /Share with Sam Rivera/ })).toBeVisible();
  });

  it('says so when everybody already has access, rather than drawing an empty grid', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json([SAM])));
    show();
    expect(
      await screen.findByText(/everybody with an account here already has access/i),
    ).toBeVisible();
    expect(screen.queryByRole('group', { name: /who to share with/i })).not.toBeInTheDocument();
  });

  it('says who creates accounts when there is nobody else to share with', async () => {
    server.use(http.get('/api/users', () => HttpResponse.json([])));
    show();
    expect(await screen.findByText(/an administrator creates them/i)).toBeVisible();
  });
});

describe('the sharing panel', () => {
  it('names the person, their address, and when it was shared', async () => {
    show();
    expect(await screen.findByText('Sam Rivera')).toBeInTheDocument();
    expect(screen.getByText('sam@example.test')).toBeInTheDocument();
    expect(screen.getByText(/Shared by Alex Morgan/)).toBeInTheDocument();
  });

  it('is one row per person, with their level named and its sentence in the menu', async () => {
    show();
    const level = await screen.findByRole('combobox', { name: 'What Sam Rivera can do' });
    expect(level).toHaveTextContent('Can edit');
    expect(screen.queryByText(/change titles, categories and tags/i)).not.toBeInTheDocument();
    await userEvent.click(level);
    // The sentence lives beside the levels in the backend and arrives with the share.
    expect(
      await screen.findByText(/change titles, categories and tags, but not move, trash or share/i),
    ).toBeVisible();
  });

  it('changes a level, which is the same grant', async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'What Sam Rivera can do' }));
    await userEvent.click(await screen.findByRole('option', { name: /Can manage/i }));
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

describe('the level selector explains a level nobody holds (API-18)', () => {
  it("offers every grantable level in the instance's own words", async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'What Sam Rivera can do' }));
    // The mock library is shared at one level only. Before `API-18` the other two had nothing to
    // render, because `level_description` rides on a grant and describes the levels in use.
    for (const clause of [
      /listen and read the transcript, and change nothing/i,
      /change titles, categories and tags, but not move, trash or share/i,
      /everything above, plus moving, trashing and sharing with other people/i,
    ]) {
      expect((await screen.findAllByText(clause)).length).toBeGreaterThan(0);
    }
  });

  it('never offers owner, which is held rather than granted', async () => {
    show();
    await userEvent.click(await screen.findByRole('combobox', { name: 'What Sam Rivera can do' }));
    await screen.findAllByText(/listen and read the transcript/i);
    expect(screen.queryByText(/the library belongs to them/i)).not.toBeInTheDocument();
  });
});
