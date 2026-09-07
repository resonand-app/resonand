/**
 * V3's card grid (`UI-6b`, §V3, §1.3).
 *
 * The four states have to be told apart without colour, a title has to survive being long, and
 * the date on a card is the recording's own wall-clock reading rather than the reader's evening.
 * All three are things a screenshot would not show.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { AVIA, CARRER_NOU, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { LibraryView } from './LibraryView';

mockApi();

function renderLibrary(uuid: string = AVIA) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toLibrary(uuid)]}>
          <Routes>
            <Route path="/library/:uuid" element={<LibraryView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** One card, found by the recording it is about. */
async function cardFor(title: string): Promise<HTMLElement> {
  const link = await screen.findByRole('link', { name: title });
  const card = link.closest('article');
  if (card === null) throw new Error(`The card for ${title} is not an article.`);
  return card;
}

describe('a card', () => {
  it('opens the recording from its title, by keyboard', async () => {
    renderLibrary();
    const card = await cardFor('The house on Carrer Nou');
    expect(within(card).getByRole('link', { name: 'The house on Carrer Nou' })).toHaveAttribute(
      'href',
      `/recording/${CARRER_NOU}`,
    );
  });

  it('plays without leaving the grid, from a control named after the recording', async () => {
    renderLibrary();
    const card = await cardFor('The house on Carrer Nou');
    expect(
      within(card).getByRole('button', { name: 'Play The house on Carrer Nou' }),
    ).toBeVisible();
  });

  it('says the transcription state in words, not only in colour', async () => {
    renderLibrary();
    // Amber and red are not enough: somebody who cannot tell them apart still has to be able to
    // tell "in progress" from "failed".
    expect(
      within(await cardFor('Cançons que cantava la mare')).getByText('Transcribing'),
    ).toBeVisible();
    expect(within(await cardFor('The house on Carrer Nou')).getByText('Transcribed')).toBeVisible();
  });

  it('shows the duration and the recording own date, as written', async () => {
    renderLibrary();
    const card = await cardFor('The house on Carrer Nou');
    // 48:12, and half six on the evening of 12 March -- the clock reading where the recording
    // was made. `recorded_at` is 18:22 with a +01:00 offset, and it renders as 6:22 PM whatever
    // timezone the reader or the test runner is in (§1.3).
    expect(within(card).getByText(/48:12/)).toBeVisible();
    expect(within(card).getByText(/Mar 12, 2026, 6:22/)).toBeVisible();
  });

  it('falls back to the upload date when a recording has none of its own', async () => {
    renderLibrary();
    // A cassette digitised decades later: `recorded_at` is null, so the card shows the upload
    // instant -- which is a real date in the reader's own timezone, unlike the one above.
    const card = await cardFor('Sopar de Nadal 1998');
    expect(within(card).getByText(/12:07/)).toBeVisible();
    expect(within(card).getByText(/2026/)).toBeVisible();
  });

  it('carries the tags, and turns the rest into a count', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU
        ? {
            ...one,
            tags: [
              { id: 1, name: 'memòria', slug: 'memoria' },
              { id: 2, name: 'català', slug: 'catala' },
              { id: 3, name: 'família', slug: 'familia' },
              { id: 4, name: 'música', slug: 'musica' },
              { id: 5, name: 'cases', slug: 'cases' },
            ],
          }
        : one,
    );
    renderLibrary();
    const card = await cardFor('The house on Carrer Nou');
    // Three, then a count: a card is 320px and every card in a grid has to be the same height.
    expect(within(card).getByText('memòria')).toBeVisible();
    expect(within(card).getByText('+2')).toBeVisible();
    expect(within(card).queryByText('cases')).toBeNull();
  });

  it('names the category the library gave the recording', async () => {
    archive.categories[AVIA] = [{ id: 7, parent_id: null, name: 'Entrevistes', position: 0 }];
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, category_id: 7 } : one,
    );
    renderLibrary();
    expect(within(await cardFor('The house on Carrer Nou')).getByText('Entrevistes')).toBeVisible();
  });

  it('draws no waveform for a recording whose peaks job has not run', async () => {
    renderLibrary(PERSONAL);
    // `Nota de veu` is still being processed: `has_waveform` is false, so the request that would
    // 404 is never made and the card draws a dashed rule rather than an invented shape (§3.5).
    const card = await cardFor('Nota de veu 12 mar');
    await waitFor(() => {
      expect(screen.getByText('Assaig 4 de febrer')).toBeInTheDocument();
    });
    expect(card.querySelector('[data-ds="waveform"]')).toBeNull();
  });

  it('draws a waveform once the peaks have arrived', async () => {
    renderLibrary();
    const card = await cardFor('The house on Carrer Nou');
    await waitFor(() => {
      expect(card.querySelector('[data-ds="waveform"]')).not.toBeNull();
    });
  });
});
