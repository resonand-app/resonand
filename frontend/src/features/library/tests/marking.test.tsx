/**
 * Marking favourites from a library (`UI-42`): one heart at a time on a card or a row, and a
 * selection's worth at once from the bulk bar.
 *
 * The heart is optimistic, so the thing worth proving is the way back: a refusal has to leave the
 * heart as it was and say so, or a press that failed reads as one that worked.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { useToasts } from '@/app/toasts';
import { ThemeProvider } from '@/design-system';
import { CASSETTE, FIELD_TAKE, RECORDINGS, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibraryView } from '../LibraryView';

mockApi();

afterEach(() => {
  useToasts.setState({ toasts: [] });
});

function renderLibrary(search = '') {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`${toLibrary(RECORDINGS)}${search}`]}>
          <Routes>
            <Route path="/library/:uuid" element={<LibraryView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

function marked(uuid: string): boolean | undefined {
  return archive.recordings.find((one) => one.uuid === uuid)?.is_favourite;
}

async function cardFor(title: string): Promise<HTMLElement> {
  const name = await screen.findByText(title);
  const card = name.closest<HTMLElement>('[data-ds="recording-card"]');
  if (card === null) throw new Error(`no card for ${title}`);
  return card;
}

describe('the heart on a card', () => {
  it('fills at once and marks the recording', async () => {
    const user = userEvent.setup();
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    const heart = within(card).getByRole('button', {
      name: 'Favourite Field recording, long take',
    });
    await user.click(heart);
    expect(heart.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(marked(FIELD_TAKE)).toBe(true);
    });
  });

  it('goes back and says so when the archive refuses', async () => {
    const user = userEvent.setup();
    server.use(
      http.put('/api/audio/:audio_uuid/favourite', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'Error', status: 500, detail: 'Something broke.' },
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    renderLibrary();
    const card = await cardFor('Field recording, long take');
    const heart = within(card).getByRole('button', {
      name: 'Favourite Field recording, long take',
    });
    await user.click(heart);
    await waitFor(() => {
      expect(heart.getAttribute('aria-pressed')).toBe('false');
    });
    expect(useToasts.getState().toasts.map((one) => one.message)).toEqual([
      'That recording could not be marked as a favourite, so its heart is empty again.',
    ]);
    expect(marked(FIELD_TAKE)).toBe(false);
  });
});

describe('the heart in the bulk bar', () => {
  it('marks every recording selected, and then takes every mark off', async () => {
    const user = userEvent.setup();
    renderLibrary();
    for (const title of ['Field recording, long take', 'Digitised cassette']) {
      const card = await cardFor(title);
      await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    }
    await user.click(screen.getByRole('button', { name: 'Add to favourites' }));
    expect(await screen.findByText('2 recordings added to your favourites')).toBeVisible();
    expect([marked(FIELD_TAKE), marked(CASSETTE)]).toEqual([true, true]);

    // Both are favourites now, so the same control is the one that takes the marks off.
    for (const title of ['Field recording, long take', 'Digitised cassette']) {
      const card = await cardFor(title);
      await user.click(within(card).getByRole('checkbox', { name: /^Select/ }));
    }
    await user.click(await screen.findByRole('button', { name: 'Remove from favourites' }));
    expect(await screen.findByText('2 recordings taken out of your favourites')).toBeVisible();
    expect([marked(FIELD_TAKE), marked(CASSETTE)]).toEqual([false, false]);
  });
});

describe('the heart on a row', () => {
  it('marks the recording without opening it', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = () => undefined;
        unobserve = () => undefined;
        disconnect = () => undefined;
      },
    );
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(720);
    renderLibrary('?view=list');
    const name = await screen.findByText('Digitised cassette');
    const row = name.closest<HTMLElement>('[data-ds="recording-row"]');
    if (row === null) throw new Error('no row');
    await user.click(within(row).getByRole('button', { name: 'Favourite Digitised cassette' }));
    await waitFor(() => {
      expect(marked(CASSETTE)).toBe(true);
    });
    // Still the library: a press on the heart is not a press on the row.
    expect(screen.getByRole('table', { name: 'Recordings' })).toBeInTheDocument();
  });
});
