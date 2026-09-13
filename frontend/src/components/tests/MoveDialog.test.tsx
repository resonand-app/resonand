/**
 * V8 · Moving a recording (`UI-19a`, `UI-19b`, §V8).
 *
 * The dialog exists to say three things before the move, so the tests are about those three
 * sentences rather than about the request: **who gains access and who loses it, by name**, which
 * is the whole reason it is a screen; the category that will be lost, named; and the individual
 * grants that survive.
 *
 * The destination list is the other half: only libraries somebody can add to, never the one the
 * recordings are already in, and a plain sentence rather than an empty picker when there is
 * nowhere to go.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { ATENEU, AVIA, CARRER_NOU, NADAL, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { MoveDialog } from '../MoveDialog';
import type { Movable } from '../MoveDialog';

mockApi();

const CARRER: Movable = {
  uuid: CARRER_NOU,
  title: 'The house on Carrer Nou',
  library_uuid: AVIA,
  category_id: 1,
};

const NADAL_RECORDING: Movable = {
  uuid: NADAL,
  title: 'Sopar de Nadal 1998',
  library_uuid: AVIA,
  category_id: null,
};

function renderDialog(
  recordings: Movable[] = [CARRER],
  onConfirm = vi.fn<(uuid: string) => void>(),
) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const names = new Map([
    [1, 'Converses'],
    [2, 'Cançons'],
  ]);
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter>
          <MoveDialog
            recordings={recordings}
            categoryName={(id) => (id === null ? undefined : names.get(id))}
            onClose={vi.fn()}
            onConfirm={onConfirm}
          />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { onConfirm };
}

/** Choose a destination, which is what makes the consequences appear. */
async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
  await user.click(await screen.findByRole('option', { name }));
}

describe('where it can go', () => {
  it('offers the libraries you can add to, and not the one it is already in', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
    // `Personal` is the account's own and `Reunions Ateneu` is shared at level 20, so both are
    // destinations. `Àvia Teresa` is where the recording already is.
    expect(await screen.findByRole('option', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Reunions Ateneu' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Àvia Teresa' })).toBeNull();
  });

  it('leaves out a library you can only read', async () => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === ATENEU ? { ...one, level: 10 } : one,
    );
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
    expect(screen.queryByRole('option', { name: 'Reunions Ateneu' })).toBeNull();
  });

  it('says there is nowhere to go rather than showing an empty picker', async () => {
    archive.libraries = archive.libraries.filter((one) => one.uuid === AVIA);
    renderDialog();
    // An empty select reads as something that failed to load (§V8).
    expect(await screen.findByText(/There is nowhere to move this to/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Move to' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move it' })).toBeNull();
  });

  it('will not move anything until a destination is chosen', async () => {
    renderDialog();
    expect(await screen.findByRole('button', { name: 'Move it' })).toBeDisabled();
  });

  it('hands the destination back rather than moving anything itself', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog();
    await choose(user, 'Personal');
    await user.click(screen.getByRole('button', { name: 'Move it' }));
    // The caller moves: a selection is one request per recording, and the partial-failure report
    // that follows belongs to the bulk machinery rather than to this dialog (`UI-9c`).
    expect(onConfirm).toHaveBeenCalledWith(PERSONAL);
  });
});

describe('what it says will happen', () => {
  it('names who gains access and who loses it', async () => {
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    // `Àvia Teresa` is shared with Marta and `Personal` is not, so Marta loses access. Nobody
    // gains it: both belong to Gabriel.
    expect(await screen.findByText(/Marta will no longer be able to see it/)).toBeInTheDocument();
  });

  it('names who gains it when the destination is shared more widely', async () => {
    archive.shares = { ...archive.shares, [AVIA]: [] };
    archive.shares = {
      ...archive.shares,
      [PERSONAL]: [
        {
          grantee: { id: 2, display_name: 'Marta', email: 'marta@example.test' },
          level: 20,
          level_description: 'Can add recordings and edit their details.',
          granted_by: 1,
          created_at: '2026-02-01T12:00:00Z',
        },
      ],
    };
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    expect(await screen.findByText(/Marta will be able to see it/)).toBeInTheDocument();
  });

  it('says so plainly when the same people can see it either way', async () => {
    archive.shares = { ...archive.shares, [AVIA]: [] };
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    expect(await screen.findByText(/The same people can see it/)).toBeInTheDocument();
  });

  it('names the category that will be lost', async () => {
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    // Named, not warned about: the choice is between a known cost and the move.
    expect(await screen.findByText(/It loses its category, Converses/)).toBeInTheDocument();
  });

  it('says there is no category to lose when there is not one', async () => {
    const user = userEvent.setup();
    renderDialog([NADAL_RECORDING]);
    await choose(user, 'Personal');
    expect(await screen.findByText(/It has no category to lose/)).toBeInTheDocument();
  });

  it('says the destination has no categories, which is fine', async () => {
    const user = userEvent.setup();
    renderDialog();
    // `Personal` has none in the fixtures, so the recording arrives uncategorised -- a state, not
    // a problem (§V8).
    await choose(user, 'Personal');
    expect(await screen.findByText(/arrives uncategorised/)).toBeInTheDocument();
  });

  it('says the individual grants survive, because that is surprising', async () => {
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    expect(await screen.findByText(/shared with individually keeps access/)).toBeInTheDocument();
  });
});

describe('a whole selection', () => {
  it('states the consequences once for the set rather than per recording', async () => {
    const user = userEvent.setup();
    renderDialog([CARRER, NADAL_RECORDING]);
    expect(await screen.findByRole('dialog', { name: 'Move 2 recordings' })).toBeInTheDocument();
    await choose(user, 'Personal');
    // One sentence about the categories, naming the one that is actually lost, and no list of
    // titles: it has to survive a selection of two hundred.
    expect(await screen.findByText(/They lose their categories \(Converses\)/)).toBeInTheDocument();
    expect(screen.queryByText('Sopar de Nadal 1998')).toBeNull();
  });
});
