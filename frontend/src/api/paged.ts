/**
 * A page of a collection, and how tall the list is before it arrives (`UI-3c`).
 *
 * Every list endpoint answers the same envelope -- `items`, `total`, `limit`, `offset` -- and the
 * dense list is virtualised (`UI-7`), which means it has to know how many rows exist before it
 * has any of them. Two things make that true:
 *
 * **`total` survives a refetch.** Keeping the previous page while the next one loads is what
 * stops the scrollbar jumping to the top and back every time a filter changes -- the count is
 * the last thing that should flicker.
 *
 * **`total` is the count of rows that match, not the count of rows fetched.** The API says so,
 * and this is where that distinction is kept, because `items.length` is right there and looks
 * like the same number until a collection is longer than one page.
 */

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InfiniteData, Query, QueryKey, UseQueryResult } from '@tanstack/react-query';

/** The envelope every list endpoint answers with. */
export interface Page<Item> {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
}

/** How many rows a list asks for at a time. The API's own default. */
export const PAGE_SIZE = 50;

/**
 * The largest page the API will answer, from `sonarium.api.pagination.MAX_LIMIT`.
 *
 * For the one caller that wants a whole collection rather than a window of it -- selecting every
 * recording a filter matches (`UI-9a`) -- where the choice is between four requests and sixteen.
 */
export const MAX_PAGE_SIZE = 200;

export interface PagedResult<Item> extends Omit<UseQueryResult<Page<Item>>, 'data'> {
  /** The rows on this page. Empty while the first page is loading. */
  items: Item[];
  /** How many rows match the filters, which is the height of the list. */
  total: number;
  /** Whether asking for the next offset would return anything. */
  hasMore: boolean;
  /** Whether these rows are the previous filter's, still on screen while the next ones load. */
  isPlaceholder: boolean;
}

/**
 * Run a paged query and read its envelope.
 *
 * `enabled: false` is a real state and not an error: a library's list cannot be fetched before
 * the route has a uuid, and a search is not a search until something has been typed.
 */
export function usePaged<Item>(
  key: QueryKey,
  fetchPage: () => Promise<Page<Item>>,
  options: {
    enabled?: boolean;
    /** How often to ask again, read off the page itself. `false` for a list that is finished. */
    refetchInterval?: (query: Query<Page<Item>>) => number | false;
  } = {},
): PagedResult<Item> {
  const query = useQuery({
    queryKey: key,
    queryFn: fetchPage,
    // The previous page stays on screen while the next one loads. Without it every filter
    // change empties the list, measures it at zero rows, and fills it again.
    placeholderData: keepPreviousData,
    ...options,
  });
  const { data, ...rest } = query;
  return {
    ...rest,
    items: data?.items ?? [],
    total: data?.total ?? 0,
    hasMore: data ? data.offset + data.items.length < data.total : false,
    isPlaceholder: query.isPlaceholderData,
  };
}

/** The `limit` and `offset` a page of this size at this position asks for. */
export function pageWindow(
  page: number,
  size: number = PAGE_SIZE,
): { limit: number; offset: number } {
  return { limit: size, offset: Math.max(0, page) * size };
}

/**
 * A collection that grows as somebody asks for more of it (`UI-3c`).
 *
 * The card grid is not on a page and cannot be: a card is tall, a screenful is a handful of them,
 * and V3 is a wall somebody scrolls down rather than a table they page through. So the pages
 * accumulate into one list and the envelope's `total` says whether another exists -- which also
 * lets the footer be honest about how much of the library is on screen, in the same way the dense
 * list's scrollbar is honest about how long it is.
 *
 * The next offset is where the rows fetched so far end, never the page number times the size. The
 * API answers the window it was given, and a page shorter than the one asked for is the end of the
 * collection rather than a gap to skip over.
 */
export interface InfiniteResult<Item> {
  /** Every row fetched so far, in the order they were fetched in. */
  items: Item[];
  /** How many rows match the filters, of which `items` is the beginning. */
  total: number;
  /** Whether a further page exists. */
  hasMore: boolean;
  /** True until the first page has answered. */
  isPending: boolean;
  /** True while a further page is in flight. */
  isFetchingMore: boolean;
  error: unknown;
  /** Ask for the next page. Does nothing when there is not one. */
  fetchMore: () => void;
  refetch: () => void;
  /** Whether these rows are the previous filter's, still on screen while the next ones load. */
  isPlaceholder: boolean;
}

/**
 * How often to poll a collection that is holding `pages` of itself.
 *
 * Stretched by the depth so the cost stays flat as the grid grows: a refetch here is not one
 * request. The pages are a chain, each one's offset read off the one before, so the client
 * refetches all of them together -- and it has to. Refresh page 0 alone and an upload landing at
 * the top pushes the row that was last on it down onto page 1, where the stale copy still sits:
 * the same recording drawn twice, under one key.
 *
 * So the interval moves rather than the number of requests. A deep grid settles more slowly,
 * which costs nothing anybody sees -- what is still being made is newest, and newest is page 0,
 * where they are already looking.
 */
export function pollEvery(wanted: number | false, pages: number): number | false {
  return wanted === false ? false : wanted * Math.max(1, pages);
}

export function useInfinitePages<Item>(
  key: QueryKey,
  fetchPage: (window: { limit: number; offset: number }) => Promise<Page<Item>>,
  options: {
    enabled?: boolean;
    /** How often to ask again, read off every row fetched so far. `false` for a list at rest. */
    refetchInterval?: (items: Item[]) => number | false;
  } = {},
): InfiniteResult<Item> {
  const { enabled, refetchInterval } = options;
  const query = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPage({ limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last: Page<Item>) => {
      const fetched = last.offset + last.items.length;
      return fetched < last.total ? fetched : undefined;
    },
    // The pages already fetched stay on screen while the next filter's first one loads, for the
    // same reason `usePaged` keeps its page: an emptied grid measures at nothing and jumps.
    placeholderData: keepPreviousData,
    ...(enabled === undefined ? {} : { enabled }),
    ...(refetchInterval === undefined
      ? {}
      : {
          // Stretched by however many pages are held, so the cost of polling stays flat as the
          // grid grows. A refetch here is not one request: the pages are a chain, each one's
          // offset read off the one before, so the client refetches all of them together -- and
          // it has to. Refresh page 0 alone and an upload landing at the top pushes the row that
          // was last on it down onto page 1, where the stale copy still sits: the same recording
          // drawn twice, under one key. So the interval moves rather than the number of requests,
          // and a deep grid settles more slowly -- which costs nothing anybody sees, because what
          // is still being made is at the top where they are looking.
          refetchInterval: (one: Query<Page<Item>, Error, InfiniteData<Page<Item>, number>>) => {
            const held = one.state.data?.pages ?? [];
            return pollEvery(refetchInterval(held.flatMap((page) => page.items)), held.length);
          },
        }),
  });
  const pages = query.data?.pages ?? [];
  const last = pages.at(-1);

  return {
    items: pages.flatMap((page) => page.items),
    // The last page fetched carries the freshest count, which is the one a footer should show.
    total: last?.total ?? 0,
    hasMore: query.hasNextPage,
    isPending: query.isPending,
    isFetchingMore: query.isFetchingNextPage,
    error: query.error,
    fetchMore: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
    isPlaceholder: query.isPlaceholderData,
  };
}
