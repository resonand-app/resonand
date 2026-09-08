/**
 * The category tree (`UI-17b`, §V7).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { AVIA, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { LibrarySettingsView } from './LibrarySettingsView';

mockApi();

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[toLibrarySettings(AVIA)]}>
        <Routes>
          <Route path={routes.librarySettings} element={<LibrarySettingsView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function categories() {
  return archive.categories[AVIA] ?? [];
}

describe('the tree', () => {
  it('draws the flat list as a tree, in the order somebody arranged', async () => {
    show();
    const list = await screen.findByRole('list', { name: 'Categories' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
  });

  it('adds one at the top level', async () => {
    show();
    await userEvent.type(await screen.findByLabelText('New category'), 'Cuina');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(categories().map((one) => one.name)).toContain('Cuina');
    });
  });

  it('renames one on blur, like every other name in the product', async () => {
    show();
    // Exactly "Converses": the move, delete and parent controls all carry the name too.
    await userEvent.click(await screen.findByRole('button', { name: 'Converses' }));
    const field = screen.getByDisplayValue('Converses');
    await userEvent.clear(field);
    await userEvent.type(field, 'Xerrades');
    await userEvent.tab();
    await waitFor(() => {
      expect(categories().map((one) => one.name)).toContain('Xerrades');
    });
  });

  it('moves one under another, and refuses to move it under itself', async () => {
    show();
    const parent = await screen.findByRole('combobox', { name: /What Cançons sits under/i });
    await userEvent.click(parent);
    // Its own row is not offered: a parent inside its own subtree is a cycle, and a cycle is a
    // branch the tree assembler drops -- the categories would simply disappear.
    expect(screen.queryByRole('option', { name: 'Cançons' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('option', { name: 'Converses' }));
    await waitFor(() => {
      expect(categories().find((one) => one.name === 'Cançons')?.parent_id).toBe(1);
    });
  });

  it('reorders siblings by sending the whole sibling list in its new order', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Move Cançons up/i }));
    await waitFor(() => {
      expect(categories().find((one) => one.name === 'Cançons')?.position).toBe(0);
    });
    expect(categories().find((one) => one.name === 'Converses')?.position).toBe(1);
  });

  it('states in numbers what a deletion costs, and that it costs no recordings', async () => {
    archive.recordings = archive.recordings.map((one, index) =>
      index === 0 ? { ...one, category_id: 1, library_uuid: AVIA } : one,
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Delete Converses/i }));
    expect(await screen.findByText(/loses its category. It is not deleted/i)).toBeVisible();
  });

  it('deletes the category and leaves the recordings where they are', async () => {
    const before = archive.recordings.length;
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Delete Converses/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete the category' }));
    await waitFor(() => {
      expect(categories().map((one) => one.name)).not.toContain('Converses');
    });
    expect(archive.recordings).toHaveLength(before);
  });
});
