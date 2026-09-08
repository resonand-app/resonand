/**
 * The dropdown under the nav field (`UI-16a`, §3.2).
 *
 * **The three-second case, and nothing else.** Type a word, see the top few recordings with the
 * line that matched and where in the recording it is, press one, be there. Everything the full
 * view has -- the honest counts, the filters, the grouping, playing a match without leaving the
 * page -- is deliberately absent: a dropdown that grew them would be the search screen drawn in a
 * 380px box under a text field, and the see-all row would stop meaning anything.
 *
 * **One recording per row, not one match per row.** A long interview matches forty times and would
 * otherwise fill the dropdown by itself; the first match is the one shown, because at this size
 * the question is which recording rather than where in it.
 *
 * `⌘K` and `/` put the caret here from anywhere (§1.8, `UI-4g`); `Enter` and the see-all row both
 * leave for `/search`, carrying the query. Which is also why nothing here writes to the URL as it
 * is typed: a keystroke is not a navigation, and a history entry per letter is a back button
 * nobody can use.
 */

import { useTranslation } from 'react-i18next';

import { timestamp } from '@/i18n/format';
import { SearchResults } from '@/design-system';
import type { SearchHit } from '@/design-system';

import { QUICK_HITS, useSearch } from './data';
import { marked } from './fragment';

export interface QuickHitsProps {
  /** What is in the field, which is not what is in the URL until somebody leaves. */
  query: string;
  /** Open one: the detail view, at that recording. */
  onOpen: (uuid: string) => void;
  /** Leave for the full results. The see-all row, and `Enter`. */
  onSeeAll: () => void;
}

export function QuickHits({ query, onOpen, onSeeAll }: QuickHitsProps) {
  const { t } = useTranslation('search');
  const results = useSearch(
    { q: query, tags: [], states: [], sort: 'recorded_at', direction: 'desc', view: 'grid' },
    { limit: QUICK_HITS, offset: 0 },
  );

  // Nothing yet is nothing drawn. A box saying "no results" under the field after one letter is
  // an answer to a question nobody has finished asking; the full view is where a real empty
  // result is stated, with the recall note next to it.
  if (results.items.length === 0) return null;

  const hits: SearchHit[] = results.items.map((result) => {
    const first = result.matches[0];
    return {
      kind: 'recording',
      title: result.audio.title,
      ...(first === undefined ? {} : { excerpt: marked(first.fragment) }),
      // A metadata match has no moment in the recording to show (`UI-16f`), so the column is
      // empty rather than carrying a zero that would seek to the beginning.
      ...(first?.start_ms == null ? {} : { at: timestamp(first.start_ms) }),
    };
  });

  return (
    <SearchResults
      hits={hits}
      total={results.total}
      query={query}
      labels={{ seeAll: t('quick.seeAll', { count: results.total, query }) }}
      onOpen={(hit) => {
        // By position rather than by title: two recordings can be called the same thing, and the
        // one somebody pressed is the one they pressed. `SearchResults` hands back the object it
        // was given, so its index in the array is the row.
        const uuid = results.items[hits.indexOf(hit)]?.audio.uuid;
        if (uuid !== undefined) onOpen(uuid);
      }}
      onSeeAll={onSeeAll}
      style={{
        position: 'absolute',
        top: 'calc(100% + var(--space-2))',
        left: 0,
        right: 0,
        zIndex: 'var(--z-menu)',
      }}
    />
  );
}
