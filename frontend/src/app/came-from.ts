/**
 * The list a recording was opened from, so the way back is the way in.
 *
 * `url-state.ts` settles what lives in the URL; this settles what lives in the history entry
 * beside it, and there are two things in it: which list, and where in it.
 *
 * The recording view's breadcrumb is a link and not a history step, deliberately: somebody who
 * arrived from a search result or from the player bar has no library behind them to go back to.
 * But a link to a bare `/library/<uuid>` throws away the query string, and §2.1 puts real state
 * there -- the view mode, the category, the tags, the state toggles and the sort. Somebody who
 * set a library to dense rows, opened one of those rows and came back was handed cards.
 *
 * So the list's own query string travels with the navigation, in the history entry rather than in
 * the URL: the recording's address stays the thing people link and bookmark, and the way back is
 * still one link with one destination. It is kept verbatim rather than rebuilt from `Filters`,
 * because the way back should be the URL they actually left.
 *
 * **Where in the list travels the same way, and it has to travel twice** (`FBK-8`). The query
 * string is enough to rebuild the list and says nothing about the sixtieth row being the one
 * somebody was reading, so a library that comes back at the top has thrown away the scrolling
 * they did to find the recording they are returning from. The offsets ride out to the recording
 * with the query string, and back again on the breadcrumb's navigation.
 *
 * **The browser's own Back is the other way back, and it is not a push.** Nothing travels on a
 * pop: it returns to the entry that was left, carrying the state that entry already had. So the
 * list writes the offsets onto its own entry before it leaves, with a `replace` -- which adds no
 * history and is precisely what "where this entry was" means. Both ways back then read the same
 * one field, and there is no table of recent scroll positions to keep, bound or leak.
 *
 * Offsets stay out of the URL for the reason the query string is in it: `?top=847` is not an
 * address anybody meant to share, and it would rewrite itself under somebody as they scrolled.
 *
 * When there is nothing to carry -- a pasted link, a new tab, the player bar, a search result --
 * the breadcrumb is the bare library it has always been, and the list opens at the top.
 */

import { type Location, useLocation } from 'react-router';

/**
 * Where a library was left, by scrollport.
 *
 * Two of them, because the dense list is a scrollport inside a scrollport and they answer
 * different questions: `page` is the box the frame gives every view, and `list` is the
 * virtualiser's own, which is the row somebody was actually reading. A grid has only the first.
 */
export interface Offsets {
  page: number;
  list?: number;
}

interface CameFrom {
  list?: string;
  offsets?: Offsets;
}

/** `navigate`'s options for opening a recording from a list, carrying it and the place in it. */
export function fromList(search: string, offsets: Offsets): { state: CameFrom } {
  return { state: { list: search, offsets } };
}

/** `navigate`'s options for the breadcrumb, handing the list back the place it was left at. */
export function backToList(offsets: Offsets | undefined): { state: CameFrom } | undefined {
  return offsets === undefined ? undefined : { state: { offsets } };
}

/** `navigate`'s options for a list noting on its own entry where it was, for the Back that pops to it. */
export function stayingAt(offsets: Offsets): { replace: true; state: CameFrom } {
  return { replace: true, state: { offsets } };
}

/** The query string of the list to go back to, empty when this view was not reached from one. */
export function useCameFromList(): string {
  return stateIn(useLocation()).list ?? '';
}

/**
 * Where this arrival is to be put back to, and nothing when it is an arrival rather than a return.
 *
 * One field for both ways back: the breadcrumb hands it over on a push, and a pop finds it on the
 * entry the list wrote it onto before leaving.
 */
export function useCameFromOffsets(): Offsets | undefined {
  return stateIn(useLocation()).offsets;
}

// Annotated rather than inferred: react-router types history state as `any`, and the whole point
// of this module is that it arrives from outside and has to be checked. The two fields are read
// independently, because they travel out to a recording together and only one comes back.
function stateIn(location: Location<unknown>): CameFrom {
  const state: unknown = location.state;
  if (typeof state !== 'object' || state === null) return {};
  const { list, offsets } = state as CameFrom;
  return {
    ...(typeof list === 'string' ? { list } : {}),
    ...(isOffsets(offsets) ? { offsets } : {}),
  };
}

function isOffsets(value: unknown): value is Offsets {
  if (typeof value !== 'object' || value === null || !('page' in value)) return false;
  const { page, list } = value as Offsets;
  return typeof page === 'number' && (list === undefined || typeof list === 'number');
}
