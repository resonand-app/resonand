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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { MEETINGS, RECORDINGS, FIELD_TAKE, CASSETTE, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { MoveDialog } from '../MoveDialog';
import type { Movable } from '../MoveDialog';

mockApi();

const FIELD_RECORDING: Movable = {
  uuid: FIELD_TAKE,
  title: 'Field recording, long take',
  library_uuid: RECORDINGS,
  category_id: 1,
};

const CASSETTE_RECORDING: Movable = {
  uuid: CASSETTE,
  title: 'Digitised cassette',
  library_uuid: RECORDINGS,
  category_id: null,
};

function renderDialog(
  recordings: Movable[] = [FIELD_RECORDING],
  onConfirm = vi.fn<(uuid: string) => void>(),
) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const names = new Map([
    [1, 'Interviews'],
    [2, 'Fieldwork'],
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
    // `Personal` is the account's own and `Meetings` is shared at level 20, so both are
    // destinations. `Field recordings` is where the recording already is.
    expect(await screen.findByRole('option', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Meetings' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Field recordings' })).toBeNull();
  });

  it('leaves out a library you can only read', async () => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === MEETINGS ? { ...one, level: 10 } : one,
    );
    const user = userEvent.setup();
    renderDialog();
    await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
    expect(screen.queryByRole('option', { name: 'Meetings' })).toBeNull();
  });

  it('says there is nowhere to go rather than showing an empty picker', async () => {
    archive.libraries = archive.libraries.filter((one) => one.uuid === RECORDINGS);
    renderDialog();
    // An empty select reads as something that failed to load (§V8).
    expect(await screen.findByText(/There is nowhere to move this to/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Move to' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move it' })).toBeNull();
  });

  it('opens on the picker, not on the control that closes it', async () => {
    renderDialog();
    // The destination is the only reason this dialog is open, and a `Dialog` draws its close
    // control first -- so without asking, the keyboard lands on the way out of the screen.
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Move to' })).toHaveFocus();
    });
  });

  it('falls back to the close control when there is nowhere to go', async () => {
    archive.libraries = archive.libraries.filter((one) => one.uuid === RECORDINGS);
    renderDialog();
    // There is no picker to land on, and a dialog with nothing to choose has nothing to do but
    // be left -- so the marker going missing has to be ordinary rather than an exception.
    expect(await screen.findByText(/There is nowhere to move this to/)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    });
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
    // `Field recordings` is shared with Sam Rivera and `Personal` is not, so Sam Rivera loses access. Nobody
    // gains it: both belong to Alex Morgan.
    expect(
      await screen.findByText(/Sam Rivera will no longer be able to see it/),
    ).toBeInTheDocument();
  });

  it('names who gains it when the destination is shared more widely', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
    archive.shares = {
      ...archive.shares,
      [PERSONAL]: [
        {
          grantee: { id: 2, display_name: 'Sam Rivera', email: 'sam@example.test' },
          level: 20,
          level_description: 'Can add recordings and edit their details.',
          granted_by: 1,
          source: 'library',
          created_at: '2026-02-01T12:00:00Z',
        },
      ],
    };
    const user = userEvent.setup();
    renderDialog();
    await choose(user, 'Personal');
    expect(await screen.findByText(/Sam Rivera will be able to see it/)).toBeInTheDocument();
  });

  it('says so plainly when the same people can see it either way', async () => {
    archive.shares = { ...archive.shares, [RECORDINGS]: [] };
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
    expect(await screen.findByText(/It loses its category, Interviews/)).toBeInTheDocument();
  });

  it('says there is no category to lose when there is not one', async () => {
    const user = userEvent.setup();
    renderDialog([CASSETTE_RECORDING]);
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
    renderDialog([FIELD_RECORDING, CASSETTE_RECORDING]);
    expect(await screen.findByRole('dialog', { name: 'Move 2 recordings' })).toBeInTheDocument();
    await choose(user, 'Personal');
    // One sentence about the categories, naming the one that is actually lost, and no list of
    // titles: it has to survive a selection of two hundred.
    expect(
      await screen.findByText(/They lose their categories \(Interviews\)/),
    ).toBeInTheDocument();
    expect(screen.queryByText('Digitised cassette')).toBeNull();
  });
});
