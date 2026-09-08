/**
 * V4's dense list (`UI-7a`, §V4).
 *
 * The property this view exists for is the honest scrollbar: the list has to be as tall as the
 * library is before the library has been fetched, because a scrollbar that grows as pages arrive
 * tells somebody the list is short and they stop scrolling. `total` is what makes that possible
 * and `pagesFor` is what keeps it affordable, so both are tested directly -- jsdom reports every
 * element as zero-height, so the virtualiser's own arithmetic cannot be observed through it.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { PAGE_SIZE } from '@/api/paged';
import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { usePlayback } from '@/player/store';
import { AVIA, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibraryView } from './LibraryView';
import { pagesFor } from './rows';

// The stylesheet as text: `vitest.config.ts` processes `?raw` for exactly this (`UI-32a`).
import components from '@/design-system/components.css?raw';

mockApi();

afterEach(() => {
  usePlayback.getState().stop();
});

function renderList(uuid: string = AVIA) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`${toLibrary(uuid)}?view=list`]}>
          <Routes>
            <Route path="/library/:uuid" element={<LibraryView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('which pages a scroll position needs', () => {
  it('always includes the first, because that is where the height comes from', () => {
    expect(pagesFor({ start: 600, end: 640 }, 50)).toEqual([0, 12]);
  });

  it('spans the pages a range crosses rather than only the one it starts in', () => {
    expect(pagesFor({ start: 45, end: 105 }, 50)).toEqual([0, 1, 2]);
  });

  it('asks for one page when the range sits inside one', () => {
    expect(pagesFor({ start: 0, end: 20 }, 50)).toEqual([0]);
  });

  it('treats a range that arrives backwards as the page it starts in', () => {
    expect(pagesFor({ start: 30, end: 0 }, 50)).toEqual([0]);
  });
});

describe('the dense list', () => {
  it('is read as a table, and says how many rows there are one request in', async () => {
    renderList();
    const table = await screen.findByRole('table', { name: 'Recordings' });
    // Three in the fixture library. The count is `total` from the first page response, which is
    // the number the scrollbar is measured against -- not the rows in hand.
    await waitFor(() => {
      expect(table).toHaveAttribute('aria-rowcount', '3');
    });
  });

  it('keeps its column header on screen and names the columns that never collapse', async () => {
    renderList();
    await screen.findByRole('table');
    for (const column of ['Title', 'Length', 'Shape']) {
      expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument();
    }
  });

  it('counts the whole library rather than the page in hand', async () => {
    // A library longer than one page: the honest-scrollbar case, and the one where a list that
    // counted `items.length` would claim the library is a fifth of its real size.
    const many = Array.from({ length: 537 }, (_, index) => ({
      ...archive.recordings[0],
      uuid: `bbbbbbbb-0000-4000-8000-${String(index).padStart(12, '0')}`,
      library_uuid: AVIA,
      title: `Recording ${String(index)}`,
    }));
    archive.recordings = many as typeof archive.recordings;
    renderList();
    const table = await screen.findByRole('table');
    // 537 rows from a 50-row page: a list that counted `items.length` would claim the library is
    // a tenth of its real size, and somebody would stop scrolling at row fifty.
    await waitFor(() => {
      expect(table).toHaveAttribute('aria-rowcount', '537');
    });
    expect(PAGE_SIZE).toBeLessThan(537);
  });

  it('asks for one page, not for the whole library', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderList();
    await screen.findByRole('table');
    const listing = asked.filter((url) => url.includes(`/libraries/${AVIA}/audio`));
    expect(listing.length).toBeGreaterThan(0);
    for (const url of listing) expect(url).toContain(`limit=${String(PAGE_SIZE)}`);
  });
});

describe('which columns go, and in which order', () => {
  /**
   * Read off the stylesheet, because a media query is the one thing jsdom cannot answer: it
   * reports every element as zero-width and matches no `@media` condition, so the collapse can
   * only be checked as a claim the CSS makes. `interaction-layer.ts` reads the same file for the
   * same reason.
   */
  const bands = [
    ...components.matchAll(/@media \(max-width: (\d+)px\)\s*\{\s*\[data-column='([a-z]+)'\]/g),
  ].map((found) => ({ width: Number(found[1]), column: found[2] }));

  it('drops the four columns the specification names, and only those', () => {
    expect(bands.map((band) => band.column)).toEqual(['tags', 'category', 'waveform', 'date']);
  });

  it('drops them at the four widths, widest first', () => {
    expect(bands.map((band) => band.width)).toEqual([900, 800, 700, 620]);
  });

  it('leaves the irreducible row alone', () => {
    // Title, length, transcription state and play never collapse, and the way that is written
    // down is that no rule mentions them.
    for (const column of ['title', 'duration', 'state', 'play']) {
      expect(components).not.toContain(`[data-column='${column}']`);
    }
  });

  it('collapses a heading with the column it names', async () => {
    renderList();
    await screen.findByRole('table');
    // The heading carries the same marker as the cell, so the two go together -- a heading over a
    // column that is not there names the wrong one.
    for (const column of ['waveform', 'date', 'category', 'tags']) {
      expect(
        document.querySelector(`[role="columnheader"][data-column="${column}"]`),
      ).not.toBeNull();
    }
  });
});
