/**
 * V6, the full view (`UI-16b`, §V6).
 *
 * What is worth holding here is the counting. A search screen that says "20 results" over a page
 * of twenty when three hundred recordings matched is the one thing §V6 forbids, and it is a bug
 * that looks completely correct until somebody has three hundred recordings.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toSearch } from '@/app/routes';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { SearchView } from './SearchView';

mockApi();

function show(at: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route path={routes.search} element={<SearchView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A search that matches more than one page, which is the only case the counts can lie about. */
function threeHundred(shownOnAPage: number) {
  const first = archive.recordings[0];
  if (first === undefined) throw new Error('the archive has no recordings to page over');
  server.use(
    http.get('/api/search', ({ request }) => {
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      const items = Array.from({ length: Math.min(limit, shownOnAPage) }, (_, index) => ({
        audio: {
          ...first,
          uuid: `r${String(offset + index)}`,
          title: `Recording ${String(offset + index)}`,
        },
        matches: [],
        total_matches: 2,
      }));
      return HttpResponse.json({ items, total: 300, limit, offset });
    }),
  );
}

describe('the title block', () => {
  it('says the query, and how many recordings and how many matches it found', async () => {
    show(toSearch('Nadal'));
    expect(await screen.findByRole('heading', { name: 'Nadal' })).toBeInTheDocument();
    // Two different numbers: one recording matched, and two matches were found inside it.
    expect(await screen.findByText(/1 recording · 2 matches/)).toBeInTheDocument();
  });

  it('counts the recordings that matched, not the ones on this page', async () => {
    threeHundred(50);
    show(toSearch('a'));
    expect(await screen.findByText(/300 recordings/)).toBeInTheDocument();
  });
});

describe('paging through three hundred', () => {
  it('says which of them is on screen, in numbers', async () => {
    threeHundred(50);
    show(toSearch('a'));
    expect(await screen.findByText('1-50 of 300')).toBeInTheDocument();
  });

  it('goes forward and back, and cannot go back from the first page', async () => {
    threeHundred(50);
    show(toSearch('a'));
    const pages = await screen.findByRole('navigation', { name: /pages/i });
    expect(within(pages).getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(within(pages).getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('51-100 of 300')).toBeInTheDocument();
    await userEvent.click(within(pages).getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('1-50 of 300')).toBeInTheDocument();
  });

  it('is not offered at all when everything found is on the screen', async () => {
    show(toSearch('Nadal'));
    expect(await screen.findByRole('heading', { name: 'Nadal' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pages/i })).not.toBeInTheDocument();
  });
});
