/**
 * Eight hundred rows, fifty at a time (`UI-7a`, §V4).
 *
 * The dense list exists to make a large library navigable, which means it has to be as tall as
 * the library is **before** the library has been fetched. `total` is in every page response, so
 * the height is known from the first one -- and §V4 is explicit that the scrollbar has to be
 * honest about the full 537 rather than growing as pages arrive. A scrollbar that lies is worse
 * than no scrollbar: it says the list is short, and somebody stops scrolling.
 *
 * So the virtualiser counts `total` and this fetches only the pages a scroll position actually
 * needs. Three properties matter:
 *
 * **Page zero is always asked for.** It is where `total` comes from, so the list cannot be
 * measured without it, and it is what somebody sees before they scroll anywhere.
 *
 * **A page stays in the cache while its neighbours load.** Scrolling back over ground already
 * covered must not re-fetch it, which is what `staleTime` buys, and it is safe because a filter
 * change is a different query key rather than a refetch of this one.
 *
 * **A row with no page yet is a row, not a gap.** `rowAt` answers `undefined`, and the list draws
 * a skeleton at the right height. Collapsing unfetched rows would make the list change height as
 * it loads, which is the same lie in a slower form.
 */

import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { PAGE_SIZE } from '@/api/paged';
import type { Page } from '@/api/paged';

import type { Recording } from './recordings';

/** The rows a scroll position needs, as page indices. */
export function pagesFor(
  range: { start: number; end: number },
  size: number = PAGE_SIZE,
): number[] {
  const first = Math.max(0, Math.floor(range.start / size));
  const last = Math.max(first, Math.floor(Math.max(range.start, range.end) / size));
  const pages = new Set<number>([0]);
  for (let page = first; page <= last; page += 1) pages.add(page);
  return [...pages].sort((left, right) => left - right);
}

/** The query one page of this list is cached under, so the count and the rows share it. */
function pageQuery(uuid: string, query: Record<string, unknown>, page: number) {
  const parameters = { ...query, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  return {
    queryKey: keys.libraryAudio(uuid, parameters),
    queryFn: () =>
      get('/api/libraries/{library_uuid}/audio', {
        path: { library_uuid: uuid },
        query: parameters,
      }) as Promise<Page<Recording>>,
    enabled: uuid !== '',
    // The rows somebody scrolled past are the rows they are about to scroll back over.
    staleTime: 60_000,
  };
}

export interface RowCount {
  /** How many rows exist, which is the height of the list. */
  total: number;
  /** True until the first page has answered, which is while the height is still unknown. */
  isPending: boolean;
  error: unknown;
}

/**
 * How tall the list is, from the first page.
 *
 * Separate from the rows because of the order things have to happen in: the virtualiser cannot
 * be built without a count, and the range it reports is what decides which pages to fetch. So
 * the count comes from page zero on its own, and the rows below ask for page zero again -- under
 * the same key, so it is one request and the cache answers the second caller.
 */
export function useRowCount(uuid: string, query: Record<string, unknown>): RowCount {
  const first = useQuery({ ...pageQuery(uuid, query, 0), placeholderData: keepPreviousData });
  return {
    total: first.data?.total ?? 0,
    isPending: first.isPending,
    error: first.error,
  };
}

export interface Rows {
  /** The recording at an absolute index, or `undefined` while its page is in flight. */
  rowAt: (index: number) => Recording | undefined;
}

export function useRows(
  uuid: string,
  query: Record<string, unknown>,
  range: { start: number; end: number },
): Rows {
  const pages = pagesFor(range);
  const results = useQueries({ queries: pages.map((page) => pageQuery(uuid, query, page)) });

  const loaded = new Map<number, Page<Recording>>();
  pages.forEach((page, index) => {
    const data = results[index]?.data;
    if (data !== undefined) loaded.set(page, data);
  });

  return {
    rowAt: (index) => {
      const page = loaded.get(Math.floor(index / PAGE_SIZE));
      return page?.items[index % PAGE_SIZE];
    },
  };
}
