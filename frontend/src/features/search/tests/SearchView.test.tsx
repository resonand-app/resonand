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
import { HttpResponse, delay, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toSearch } from '@/app/routes';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { SearchView } from '../SearchView';

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

describe('the four states', () => {
  it('says what can be looked for and how much there is, before anything is typed', async () => {
    show(routes.search);
    expect(await screen.findByText(/look inside everything you have recorded/i)).toBeVisible();
    // Not "nothing matched": no request has been made, and answering a question nobody asked is
    // the mistake §3.5 names.
    expect(screen.queryByText(/nothing matched/i)).not.toBeInTheDocument();
  });

  it('shows the shape of the answer while it is being looked for', async () => {
    server.use(
      http.get('/api/search', async () => {
        await delay(50);
        return HttpResponse.json({ items: [], total: 0, limit: 50, offset: 0 });
      }),
    );
    show(toSearch('rehearsal'));
    expect(await screen.findByRole('status', { name: /loading/i })).toBeVisible();
  });

  it('says nothing matched, and lets the recall note explain why', async () => {
    show(toSearch('zzzznothing'));
    expect(await screen.findByText(/nothing matched "zzzznothing"/i)).toBeVisible();
    expect(await screen.findByText(/does not know that words are related/i)).toBeVisible();
  });

  it("shows the instance's own sentence rather than a copy of it", async () => {
    // The wording is the endpoint's. A constant in the bundle would describe the old index the
    // day the index changes, and nobody would know.
    server.use(
      http.get('/api/search/about', () => HttpResponse.json({ recall: 'It only finds Tuesdays.' })),
    );
    show(toSearch('zzzznothing'));
    expect(await screen.findByText('It only finds Tuesdays.')).toBeVisible();
  });

  it('says nothing about recall at all while the instance has not said anything', async () => {
    server.use(http.get('/api/search/about', () => HttpResponse.json({})));
    show(toSearch('zzzznothing'));
    expect(await screen.findByText(/nothing matched/i)).toBeVisible();
    expect(screen.queryByText(/does not know that words are related/i)).not.toBeInTheDocument();
  });

  it('states a failure with what the instance said, and offers to try again', async () => {
    server.use(
      http.get('/api/search', () =>
        HttpResponse.json(
          {
            type: '/errors/error',
            title: 'Error',
            detail: 'The index is being rebuilt.',
            status: 500,
            request_id: 'test',
          },
          { status: 500, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show(toSearch('rehearsal'));
    expect(await screen.findByText('The index is being rebuilt.')).toBeVisible();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('the title block', () => {
  it('says the query, and how many recordings and how many matches it found', async () => {
    show(toSearch('Cassette'));
    expect(await screen.findByRole('heading', { name: 'Cassette' })).toBeInTheDocument();
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
    show(toSearch('Cassette'));
    expect(await screen.findByRole('heading', { name: 'Cassette' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /pages/i })).not.toBeInTheDocument();
  });
});
