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

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { QueryKey, UseQueryResult } from '@tanstack/react-query';

/** The envelope every list endpoint answers with. */
export interface Page<Item> {
  items: Item[];
  total: number;
  limit: number;
  offset: number;
}

/** How many rows a list asks for at a time. The API's own default. */
export const PAGE_SIZE = 50;

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
  options: { enabled?: boolean } = {},
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
