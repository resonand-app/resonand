/**
 * What lives in the URL, and what does not (`UI-4b`, §2.1).
 *
 * The division is the specification's and it is not a matter of taste:
 *
 * **In the URL** -- the search query and its filters; a library's view mode, category, tags,
 * state toggles and sort; and the recording being viewed. These are the things people link,
 * bookmark and reload into. A filtered library that loses its filter on refresh is a filter
 * nobody trusts enough to use.
 *
 * **Not in the URL** -- what is playing and where it is, the upload tray's contents, and whether
 * a dialog is open. The player is global and survives navigation (`UI-5a`); putting its position
 * in the address bar would make every second of playback a history entry. Upload and move have no
 * route at all, because an upload that dies on navigation is the one thing `UI-18` forbids.
 *
 * Reading and writing both go through here so the shape is written once. A filter nobody set is
 * **absent** rather than empty: `?transcription_state=` asks for recordings whose state is the
 * empty string, and the API would be right to answer nothing.
 */

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { components } from '@/api/contract/schema';

export type TranscriptionState = components['schemas']['TranscriptionState'];
export type SortField = components['schemas']['SortField'];
export type SortDirection = components['schemas']['SortDirection'];

/** Cards or dense rows (`V3`/`V4`). Cards is the default, so only `list` is ever written. */
export type ViewMode = 'grid' | 'list';

/**
 * Everything a list can be narrowed by.
 *
 * The same shape for a library and for search, because they are the same filter bar over the same
 * parameters -- the only difference is that search adds a query and a library is already one
 * library.
 */
export interface Filters {
  // Written out with `undefined` because `exactOptionalPropertyTypes` is on and clearing a
  // filter means saying so: `{ categoryId: undefined }` is how a control turns one off.
  q?: string | undefined;
  library?: string | undefined;
  categoryId?: number | undefined;
  tags: string[];
  states: TranscriptionState[];
  recordedFrom?: string | undefined;
  recordedTo?: string | undefined;
  minDurationMs?: number | undefined;
  maxDurationMs?: number | undefined;
  sort: SortField;
  direction: SortDirection;
  view: ViewMode;
}

/** The API's own defaults, so an unfiltered list sends no parameters at all. */
export const DEFAULTS = {
  sort: 'recorded_at',
  direction: 'desc',
  view: 'grid',
} as const satisfies Pick<Filters, 'sort' | 'direction' | 'view'>;

const STATES: readonly TranscriptionState[] = ['none', 'running', 'done', 'failed'];
const SORTS: readonly SortField[] = ['recorded_at', 'created_at', 'title', 'duration_ms'];

/**
 * The sort a view starts from, and the sorts it offers (`UI-44`).
 *
 * A view's own, because the sort it starts from is the one never written to the URL: if the
 * favourites view started from "recently favourited" through a global default, choosing
 * "Recorded" there would write nothing, read back as the view's default, and could never be
 * chosen at all. A library and search use `LIBRARY`; a view that differs says so with
 * `SortDefaults`, and every control under it reads the same answer.
 */
export interface ViewSorts {
  sort: SortField;
  sorts: readonly SortField[];
}

export const LIBRARY: ViewSorts = { sort: DEFAULTS.sort, sorts: SORTS };

export const SortDefaults = createContext<ViewSorts>(LIBRARY);

/** Read the filters out of a query string. Anything unrecognised is dropped rather than passed on. */
export function filtersFrom(parameters: URLSearchParams, sorts: ViewSorts = LIBRARY): Filters {
  return {
    ...text(parameters, 'q', 'q'),
    ...text(parameters, 'library', 'library'),
    ...number(parameters, 'category_id', 'categoryId'),
    tags: parameters.getAll('tag').filter(Boolean),
    // Repeated, and a union of what is repeated (`JOB-11b`). Anything that is not one of the four
    // is discarded: a hand-edited URL should narrow a list, never widen it into an error.
    states: parameters.getAll('transcription_state').filter(isState),
    ...text(parameters, 'recorded_from', 'recordedFrom'),
    ...text(parameters, 'recorded_to', 'recordedTo'),
    ...number(parameters, 'min_duration_ms', 'minDurationMs'),
    ...number(parameters, 'max_duration_ms', 'maxDurationMs'),
    sort: sorts.sorts.find((one) => one === parameters.get('sort')) ?? sorts.sort,
    direction: parameters.get('direction') === 'asc' ? 'asc' : DEFAULTS.direction,
    view: parameters.get('view') === 'list' ? 'list' : DEFAULTS.view,
  };
}

/**
 * Write the filters back into a query string.
 *
 * A value at its default is left out, so an unfiltered list has a clean URL and the one somebody
 * copies says only what they actually changed.
 */
export function searchFrom(filters: Filters, sorts: ViewSorts = LIBRARY): URLSearchParams {
  const parameters = new URLSearchParams();
  if (filters.q) parameters.set('q', filters.q);
  if (filters.library) parameters.set('library', filters.library);
  if (filters.categoryId !== undefined) parameters.set('category_id', String(filters.categoryId));
  for (const tag of filters.tags) parameters.append('tag', tag);
  for (const state of filters.states) parameters.append('transcription_state', state);
  if (filters.recordedFrom) parameters.set('recorded_from', filters.recordedFrom);
  if (filters.recordedTo) parameters.set('recorded_to', filters.recordedTo);
  if (filters.minDurationMs !== undefined) {
    parameters.set('min_duration_ms', String(filters.minDurationMs));
  }
  if (filters.maxDurationMs !== undefined) {
    parameters.set('max_duration_ms', String(filters.maxDurationMs));
  }
  if (filters.sort !== sorts.sort) parameters.set('sort', filters.sort);
  if (filters.direction !== DEFAULTS.direction) parameters.set('direction', filters.direction);
  if (filters.view !== DEFAULTS.view) parameters.set('view', filters.view);
  return parameters;
}

/** What the API is asked, from what the URL says. The one translation between the two. */
export function queryFrom(
  filters: Filters,
): Record<string, string | number | string[] | undefined> {
  return {
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.library ? { library: filters.library } : {}),
    ...(filters.categoryId !== undefined ? { category_id: filters.categoryId } : {}),
    ...(filters.tags.length > 0 ? { tag: filters.tags } : {}),
    ...(filters.states.length > 0 ? { transcription_state: filters.states } : {}),
    ...(filters.recordedFrom ? { recorded_from: filters.recordedFrom } : {}),
    ...(filters.recordedTo ? { recorded_to: filters.recordedTo } : {}),
    ...(filters.minDurationMs !== undefined ? { min_duration_ms: filters.minDurationMs } : {}),
    ...(filters.maxDurationMs !== undefined ? { max_duration_ms: filters.maxDurationMs } : {}),
    sort: filters.sort,
    direction: filters.direction,
  };
}

/** Whether anything is narrowing this list, which is what an empty state has to know. */
export function isFiltered(filters: Filters): boolean {
  return (
    Boolean(
      filters.q ??
      filters.library ??
      filters.categoryId ??
      filters.recordedFrom ??
      filters.recordedTo ??
      filters.minDurationMs ??
      filters.maxDurationMs,
    ) ||
    filters.tags.length > 0 ||
    filters.states.length > 0
  );
}

export interface UrlState {
  filters: Filters;
  /** Change some of them. The rest are kept, so a sort does not clear a filter. */
  set: (changes: Partial<Filters>) => void;
  /** Back to an unfiltered list, keeping the query and the view mode, which are not filters. */
  clear: () => void;
}

export function useUrlState(): UrlState {
  const [parameters, setParameters] = useSearchParams();
  const sorts = useContext(SortDefaults);
  const filters = useMemo(() => filtersFrom(parameters, sorts), [parameters, sorts]);

  const set = useCallback(
    (changes: Partial<Filters>) => {
      // `replace` deliberately: typing in a filter bar would otherwise put one history entry per
      // keystroke between somebody and the page they came from.
      setParameters(searchFrom({ ...filtersFrom(parameters, sorts), ...changes }, sorts), {
        replace: true,
      });
    },
    [parameters, setParameters, sorts],
  );

  const clear = useCallback(() => {
    const kept = filtersFrom(parameters, sorts);
    setParameters(
      searchFrom(
        {
          ...kept,
          categoryId: undefined,
          tags: [],
          states: [],
          recordedFrom: undefined,
          recordedTo: undefined,
          minDurationMs: undefined,
          maxDurationMs: undefined,
        },
        sorts,
      ),
      { replace: true },
    );
  }, [parameters, setParameters, sorts]);

  return { filters, set, clear };
}

function isState(value: string): value is TranscriptionState {
  return (STATES as readonly string[]).includes(value);
}

function text<Key extends string>(
  parameters: URLSearchParams,
  name: string,
  key: Key,
): Partial<Record<Key, string>> {
  const value = parameters.get(name);
  return value ? ({ [key]: value } as Record<Key, string>) : {};
}

function number<Key extends string>(
  parameters: URLSearchParams,
  name: string,
  key: Key,
): Partial<Record<Key, number>> {
  const value = parameters.get(name);
  if (value === null || value.trim() === '' || !Number.isFinite(Number(value))) return {};
  return { [key]: Number(value) } as Record<Key, number>;
}
