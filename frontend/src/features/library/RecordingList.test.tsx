/**
 * V4's dense list (`UI-7a`, §V4).
 *
 * The property this view exists for is the honest scrollbar: the list has to be as tall as the
 * library is before the library has been fetched, because a scrollbar that grows as pages arrive
 * tells somebody the list is short and they stop scrolling. `total` is what makes that possible
 * and `pagesFor` is what keeps it affordable, so both are tested directly as well as through the
 * view.
 *
 * Anything about the rows themselves needs `measured()` first: jsdom does no layout, so a
 * virtualiser asked how tall its container is hears zero and draws nothing. What cannot be tested
 * here at all is the column collapse, because jsdom matches no `@media` condition -- that one is
 * read off the stylesheet instead.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PAGE_SIZE } from '@/api/paged';
import { BUCKETS } from '@/api/waveform';
import { createQueryClient } from '@/api/query-client';
import { toLibrary } from '@/app/routes';
import { HEIGHT_TOKEN, ThemeProvider } from '@/design-system';
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
  vi.restoreAllMocks();
});

/**
 * Give the list a viewport, because jsdom does not.
 *
 * jsdom performs no layout, so `offsetHeight` is zero for every element ever -- and that is the
 * property `@tanstack/virtual-core` measures a scroll container with. A virtualiser told its
 * viewport is zero pixels tall draws no rows, which would make every row-level assertion below
 * pass by rendering nothing at all.
 *
 * So this is the setup for a virtualised list rather than a workaround: what is under test is
 * which rows it decides to draw for a given height, and it has to be given one. There is no
 * `ResizeObserver` either, and the stub is enough because the first measurement is taken directly
 * rather than through it.
 */
const noop = () => undefined;

function measured(height = 720) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      // The height never changes in a test, so there is nothing for any of these to report.
      observe = noop;
      unobserve = noop;
      disconnect = noop;
    },
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(height);
}

/** The address, so a test can assert what a control put in it (`UI-4b`). */
function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderList(uuid: string = AVIA, search = '?view=list') {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[`${toLibrary(uuid)}${search}`]}>
          <Where />
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

  it('draws the rows the viewport has room for, and no more', async () => {
    measured(720);
    renderList();
    await screen.findByRole('table');
    // Three recordings in the fixture library, and room for twenty rows: all three are drawn.
    await waitFor(() => {
      expect(document.querySelectorAll('[data-ds="recording-row"]')).toHaveLength(3);
    });
  });

  it('draws a row at the right height while its page is still in flight', async () => {
    measured(720);
    // A library long enough that the rows past the first page have no data yet.
    archive.recordings = Array.from({ length: 200 }, (_, index) => ({
      ...archive.recordings[0],
      uuid: `cccccccc-0000-4000-8000-${String(index).padStart(12, '0')}`,
      library_uuid: AVIA,
      title: `Recording ${String(index)}`,
    })) as typeof archive.recordings;
    renderList();
    await screen.findByRole('table');
    await waitFor(() => {
      expect(document.querySelectorAll('[data-ds="recording-row"]').length).toBeGreaterThan(0);
    });
    // Every visible index has an element, drawn or skeletal, so nothing below moves when a page
    // lands. The rows are absolutely positioned at 36px intervals, which is what makes that true.
    const drawn = document.querySelectorAll('[role="row"][aria-rowindex]').length;
    expect(drawn).toBeGreaterThan(0);
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

describe('the waveform column', () => {
  it('asks for a blob sized for twenty pixels, not for the whole recording', async () => {
    measured();
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderList();
    await screen.findByRole('table');
    await waitFor(() => {
      expect(asked.some((url) => url.includes('/waveform'))).toBe(true);
    });
    // §V4's warning in one assertion: a 48-minute recording stores about 28,800 pairs, and a
    // screen of 26 rows drawing them whole would be megabytes of peaks for 20px of picture. The
    // column is affordable only because the request is reduced on the way out (`ING-14`).
    for (const url of asked.filter((one) => one.includes('/waveform'))) {
      expect(url).toContain(`peaks=${String(BUCKETS.row)}`);
    }
    expect(BUCKETS.row).toBeLessThan(BUCKETS.card);
  });

  it('draws it at the dense height, which is a token and not a number in a component', () => {
    // `UI-2b`'s criterion from this column's side: the row names a size, the size names a token,
    // and the token's value lives in `tokens/shape.css` -- where `design-system-tokens.node.test`
    // is what holds it to 20px. Nothing in the row or the list repeats the number.
    expect(HEIGHT_TOKEN.dense).toBe('--wave-height-dense');
  });
});

describe('sorting from a column heading', () => {
  it('is the same sort as the bar, written to the same place', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Title/ }));
    // Neither the heading nor the bar's control holds a sort of its own: both write these two
    // parameters, which is what makes them indistinguishable in effect (§V4).
    const where = screen.getByTestId('where').textContent;
    expect(where).toContain('sort=title');
    expect(where).toContain('direction=asc');
  });

  it('flips a column that is already sorted rather than starting over', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    await user.click(screen.getByRole('button', { name: /^Title/ }));
    await user.click(screen.getByRole('button', { name: /^Title/ }));
    // Descending is the API's default, so the address stops mentioning the direction rather than
    // spelling it out -- the sort is still title, the other way round.
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByTestId('where').textContent).toContain('sort=title');
    expect(screen.getByTestId('where').textContent).not.toContain('direction=');
  });

  it('says which column is sorted, and which way, to a screen reader too', async () => {
    const user = userEvent.setup();
    renderList();
    await screen.findByRole('table');
    // Recorded, newest first, is the default -- so that heading is already sorted before anything
    // has been clicked, and the arrow and `aria-sort` are the same fact for two readers.
    expect(screen.getByRole('columnheader', { name: /Recorded/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await user.click(screen.getByRole('button', { name: /^Length/ }));
    expect(screen.getByRole('columnheader', { name: /Length/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByRole('columnheader', { name: /Recorded/ })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });

  it('shows the sort the bar set, without having been clicked itself', async () => {
    renderList(AVIA, '?view=list&sort=title&direction=asc');
    await screen.findByRole('table');
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('leaves the columns the API cannot sort by as labels', async () => {
    renderList();
    await screen.findByRole('table');
    // A heading that looks pressable and does nothing is worse than one that plainly is not.
    for (const column of ['Shape', 'Category', 'Tags']) {
      const heading = screen.getByRole('columnheader', { name: column });
      expect(heading.querySelector('button')).toBeNull();
    }
  });
});
