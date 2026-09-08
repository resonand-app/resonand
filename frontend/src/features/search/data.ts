/**
 * What the two search surfaces ask for (`UI-16a`, §V6, §3.2).
 *
 * **Two surfaces, one endpoint, one module.** The quick-hits dropdown and the full view are not
 * alternatives -- they answer different questions -- but they are the same query with a different
 * window on it, and writing that twice is how the dropdown ends up ranking differently from the
 * page it leads to.
 *
 * The filters come from the URL, because that is where §2.1 puts them, and `url-state.ts` already
 * owns the vocabulary: search is the view that uses all of it. What is written out here rather
 * than spread from `queryFrom` is the one difference this endpoint has -- **it takes no sort**.
 * Search is ranked by how well a result matches, and offering a sort control here would be
 * offering to reorder a ranking by relevance into one that is not.
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { usePaged } from '@/api/paged';
import type { PagedResult } from '@/api/paged';
import type { components } from '@/api/schema';
import type { Filters } from '@/app/url-state';

export type SearchResult = components['schemas']['SearchResult'];
export type SearchMatch = components['schemas']['SearchMatch'];

/** How many recordings the dropdown offers before the see-all row (§3.2). */
export const QUICK_HITS = 5;

/**
 * What the API is asked, from what the URL says.
 *
 * Everything a search can be narrowed by, and nothing it cannot: a filter nobody set is absent
 * rather than empty, so an unfiltered search sends `q` and a window and nothing else.
 */
export function searchQuery(
  filters: Filters,
  window: { limit: number; offset: number },
): Record<string, unknown> {
  return {
    q: filters.q ?? '',
    ...(filters.library === undefined ? {} : { library: filters.library }),
    ...(filters.categoryId === undefined ? {} : { category_id: filters.categoryId }),
    ...(filters.tags.length > 0 ? { tag: filters.tags } : {}),
    ...(filters.states.length > 0 ? { transcription_state: filters.states } : {}),
    ...(filters.recordedFrom === undefined ? {} : { recorded_from: filters.recordedFrom }),
    ...(filters.recordedTo === undefined ? {} : { recorded_to: filters.recordedTo }),
    ...(filters.minDurationMs === undefined ? {} : { min_duration_ms: filters.minDurationMs }),
    ...(filters.maxDurationMs === undefined ? {} : { max_duration_ms: filters.maxDurationMs }),
    ...window,
  };
}

/**
 * A page of results.
 *
 * **Nothing typed is not a search.** An empty query matches everything the caller can read, which
 * would make the resting state of the search screen a request for the whole archive -- so the
 * query is not run at all until there is a word in it, and §V6's "nothing typed" state is what is
 * on screen meanwhile.
 */
export function useSearch(
  filters: Filters,
  window: { limit: number; offset: number },
): PagedResult<SearchResult> {
  const query = searchQuery(filters, window);
  return usePaged<SearchResult>(keys.search(query), () => get('/api/search', { query }), {
    enabled: (filters.q ?? '').trim() !== '',
  });
}

/**
 * What this search cannot do, in the instance's own words (`UI-16g`, §3.2).
 *
 * **Shown, never copied.** It is an endpoint rather than a constant in the bundle so that the day
 * the index changes the interface stops describing the old behaviour without anybody remembering
 * to edit it -- which means the one thing this hook must not do is supply a fallback sentence of
 * its own. Nothing to show is nothing shown.
 */
export function useRecallNote(): string | undefined {
  const { data } = useQuery({
    queryKey: keys.searchAbout(),
    queryFn: () => get('/api/search/about'),
    // A property of the index rather than of the archive: it changes when the instance is
    // upgraded, not when somebody uploads something.
    staleTime: 60 * 60_000,
  });
  return data?.recall;
}
