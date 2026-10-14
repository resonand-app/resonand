/**
 * The end of the grid, when the list does not end there (`UI-6b`).
 *
 * Its own module because two views end a grid this way: a library, and the favourites gathered
 * from every library (`UI-44`).
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system';
import * as format from '@/i18n/format';

/**
 * The end of the grid, when the library does not end there.
 *
 * A count as well as a button, because the button alone answers "is there more?" and not "how
 * much more?" -- and §V3's whole complaint about a truncated grid is that somebody cannot tell
 * they are looking at part of a library. The count is a live region for the same reason: a page
 * arriving is fifty cards appearing below the fold, which is silent to a screen reader otherwise.
 *
 * The rest is fetched on a press rather than on a scroll position. A grid that loaded as somebody
 * scrolled would keep moving the end of itself away from them, and there is nothing under the
 * grid to be kept reachable -- so the press costs one click and buys a page that stays where it
 * was put.
 */
export function MoreRecordings({
  shown,
  total,
  hasMore,
  loading,
  settling,
  onMore,
}: {
  shown: number;
  total: number;
  hasMore: boolean;
  loading: boolean;
  /** These rows are the previous filter's, still drawn while the next one's first page loads. */
  settling: boolean;
  onMore: () => void;
}) {
  const { t } = useTranslation('library');
  const asked = useRef(false);
  const count = useRef<HTMLSpanElement>(null);

  // The button is what goes when the last page lands, and it is where somebody's focus is at
  // exactly that moment -- pressing it is how they got here. Losing it drops them at the top of
  // the document, which on a grid of a hundred and forty-two cards is the whole way back.
  useEffect(() => {
    if (hasMore || !asked.current) return;
    asked.current = false;
    count.current?.focus();
  }, [hasMore]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        marginTop: 'var(--space-6)',
      }}
    >
      {/* Disabled while the filter is settling. The count and the cards are both the previous
          filter's and agree with each other, but the query behind this button is already the
          next one's -- so a press here would append its second page under the first filter's
          first, and the grid would be showing two different questions at once. */}
      {hasMore && (
        <Button
          variant="secondary"
          disabled={loading || settling}
          onClick={() => {
            asked.current = true;
            onMore();
          }}
        >
          {loading ? t('more.loading') : t('more.label')}
        </Button>
      )}
      {/* Mounted whether or not there is more to fetch: a live region that unmounts as its last
          value arrives announces nothing, and `50 of 55` reaching `55 of 55` is the sentence
          somebody pressing the button is waiting for. */}
      <span
        ref={count}
        role="status"
        tabIndex={-1}
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'var(--type-numeric-variant)',
          color: 'var(--text-3)',
        }}
      >
        {t('more.shown', { shown: format.count(shown), total: format.count(total) })}
      </span>
    </div>
  );
}
