/**
 * The recordings in a library, and the tree their categories hang in (`UI-6b`, §V3).
 *
 * One query, keyed by the filters, so a filter change is a new key rather than a refetch of the
 * same one -- which is what lets what is already on screen stay there while the next arrives.
 * `total` comes back in every response, and both densities depend on it: the dense list's
 * scrollbar has to be honest about the full length before the first page has been drawn, and the
 * grid has to know whether asking again would bring anything.
 *
 * **The grid accumulates pages rather than sitting on one** (`useInfinitePages`). A library is
 * routinely longer than the fifty rows a request answers with, and a grid holding one page has
 * nothing to say so with: no scrollbar, no page number, and a screenful of cards that looks
 * exactly like a whole small library.
 *
 * **Categories are fetched once per library and resolved here.** The API sends a flat list with
 * `parent_id`, which is the right shape to send and the wrong shape to draw: a card needs one
 * name, and a component that fetched the list to find it would fetch it once per card.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { get } from '@/api/client';
import { useLiveArchive } from '@/app/live-archive';
import { keys } from '@/api/keys';
import { MAX_PAGE_SIZE, useInfinitePages } from '@/api/paged';
import type { InfiniteResult, Page } from '@/api/paged';
import { intervalFor } from '@/api/settling';
import type { components } from '@/api/contract/schema';
import type { Filters as UrlFilters } from '@/app/url-state';
import { TRANSCRIPTION_STATE_NAMES } from '@/design-system';
import type { TranscriptionState } from '@/design-system';

export type Recording = components['schemas']['AudioSummary'];
export type Category = components['schemas']['CategorySummary'];

/**
 * What the API is asked for a library's list, from what the URL says.
 *
 * `url-state.ts` owns the filter vocabulary for every view that has one, and this is the one
 * translation into this endpoint's parameters -- written out rather than spread from `queryFrom`,
 * because that helper also carries `q` and `library`, which are search's and which this endpoint
 * does not take. A filter nobody set is absent rather than empty (§2.1).
 */
export function libraryQuery(filters: UrlFilters): Record<string, unknown> {
  return {
    ...(filters.categoryId === undefined ? {} : { category_id: filters.categoryId }),
    ...(filters.tags.length > 0 ? { tag: filters.tags } : {}),
    ...(filters.states.length > 0 ? { transcription_state: filters.states } : {}),
    sort: filters.sort,
    direction: filters.direction,
  };
}

export function useRecordings(
  uuid: string,
  query: Record<string, unknown>,
): InfiniteResult<Recording> {
  const live = useLiveArchive();
  return useInfinitePages<Recording>(
    // The window is deliberately absent from the key: the pages of one filter are one cached
    // thing, and an offset in the key would make each of them a separate one.
    keys.libraryAudio(uuid, query),
    (window) =>
      get('/api/libraries/{library_uuid}/audio', {
        path: { library_uuid: uuid },
        query: { ...query, ...window },
      }),
    {
      enabled: uuid !== '',
      // A card uploaded into a grid somebody is looking at grows its duration and its shape where
      // it stands, and the grid stops asking the moment nothing on it is still being made
      // (`FBK-3`).
      // Off while the instance is telling us what changed (`REV-12`); the interval is the
      // fallback for a stream that could not be held, not the ordinary path.
      refetchInterval: (items) => (live ? false : intervalFor(items)),
    },
  );
}

/**
 * Every recording a filter matches, not just the page in hand (`UI-9a`).
 *
 * The bulk bar offers this only after somebody has already selected everything loaded, so it is
 * asked for rather than paid for by default -- and it fetches the recordings and not their uuids,
 * because adding a tag is a read followed by a write: `PATCH` replaces the whole tag list, so a
 * selection whose tags are unknown is a selection that cannot be tagged without stripping them.
 *
 * `MAX_PAGE_SIZE` rather than the list's own window: the point here is the fewest round trips,
 * and none of these pages is going on screen.
 */
export async function fetchEveryRecording(
  uuid: string,
  query: Record<string, unknown>,
): Promise<Recording[]> {
  const all: Recording[] = [];
  for (;;) {
    const page = (await get('/api/libraries/{library_uuid}/audio', {
      path: { library_uuid: uuid },
      query: { ...query, limit: MAX_PAGE_SIZE, offset: all.length },
    })) as Page<Recording>;
    all.push(...page.items);
    // The second test is not redundant: a library that shrank between two of these pages would
    // otherwise ask for an offset past its own end for ever.
    if (all.length >= page.total || page.items.length === 0) return all;
  }
}

export interface Categories {
  /** The flat list as sent, for anything that needs the whole tree. */
  all: Category[];
  /** A category's name by its id, which is what a card and a row need. */
  nameOf: (id: number | null) => string | undefined;
}

export function useCategories(uuid: string): Categories {
  const query = useQuery({
    queryKey: keys.libraryCategories(uuid),
    queryFn: () =>
      get('/api/libraries/{library_uuid}/categories', { path: { library_uuid: uuid } }),
    enabled: uuid !== '',
    // A tree changes when somebody edits it in V7, and not otherwise. Refetching it per card grid
    // would be the landing page's waveform mistake in a different place.
    staleTime: 5 * 60_000,
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const byId = useMemo(() => new Map(all.map((one) => [one.id, one.name])), [all]);

  return {
    all,
    nameOf: (id) => (id === null ? undefined : byId.get(id)),
  };
}

/**
 * The four states, read off a field the published document types as a bare string.
 *
 * `TranscriptionState` exists in the schema and is what the filter parameter takes, but
 * `AudioSummary.transcription_state` is declared `str` with the four values written into its
 * docstring -- so the generated types say `string` here, and a renamed state would not break the
 * build the way `UI-3a` intends it to. Until the backend annotates the field, this is the
 * narrowing: an unrecognised value is `none`, the state that promises nothing, rather than a badge
 * drawn from a word the interface does not know.
 */
export function transcriptionState(value: string): TranscriptionState {
  return (TRANSCRIPTION_STATE_NAMES as readonly string[]).includes(value)
    ? (value as TranscriptionState)
    : 'none';
}
