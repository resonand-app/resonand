/**
 * The list a recording was opened from, so the way back is the way in.
 *
 * `url-state.ts` settles what lives in the URL; this settles what lives in the history entry
 * beside it, and there is exactly one thing in it.
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
 * When there is nothing to carry -- a pasted link, a new tab, the player bar, a search result --
 * the breadcrumb is the bare library it has always been.
 */

import { type Location, useLocation } from 'react-router';

interface CameFrom {
  list: string;
}

/** `navigate`'s options for opening a recording from a list, carrying that list's query string. */
export function fromList(search: string): { state: CameFrom } {
  return { state: { list: search } };
}

/** The query string of the list to go back to, empty when this view was not reached from one. */
export function useCameFromList(): string {
  // Annotated rather than inferred: react-router types history state as `any`, and the whole
  // point of this module is that it arrives from outside and has to be checked.
  const location: Location<unknown> = useLocation();
  return isCameFrom(location.state) ? location.state.list : '';
}

function isCameFrom(value: unknown): value is CameFrom {
  return (
    typeof value === 'object' &&
    value !== null &&
    'list' in value &&
    typeof (value as CameFrom).list === 'string'
  );
}
