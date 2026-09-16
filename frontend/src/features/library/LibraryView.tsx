/**
 * V3 and V4 · A library (`UI-6a`, §V3, §V4).
 *
 * One route and two densities. The grid and the dense list are not two views: they share the
 * header, the filter bar, the sort, the selection and the URL, and they differ in how a recording
 * is drawn. §V4 is emphatic that the sort is the same sort -- clicking a column heading and
 * changing the bar's control have to be indistinguishable in effect -- and the cheapest way to
 * keep that true is for there to be one component that owns both.
 *
 * **Which density is in the URL** (`UI-4b`), so a dense list is a thing somebody can link to and
 * reload into. The grid is the default, so only `?view=list` is ever written.
 *
 * **The bulk bar replaces the filter bar rather than sitting beside it** (`UI-9a`, §V3). Both are
 * the same height, so the row does not move when the first checkbox is ticked -- and a selection
 * is a mode: while one exists, the question on screen is what to do with these, not which others
 * to find.
 *
 * **A library you can only read is a different screen, and it has to look intentional** (`UI-10c`,
 * §3.5). No checkboxes, so no bulk bar; no Settings; no invitation to upload. Every one of those
 * is absent rather than disabled, because a disabled row of controls reads as a bug and their
 * absence reads as a decision -- and one quiet line at the top says why, once. What stays is
 * everything the screen is for: the recordings, the filters, the sort, the two densities, and
 * play.
 *
 * **The grid ends in a count and a button, and the dense list does not** (`UI-6b`, `UI-7a`).
 * A request answers fifty rows and a library is routinely longer, so both densities owe somebody
 * the same fact -- that what is on screen is part of a library -- and each says it in the terms it
 * has. The list is virtualised and says it with a scrollbar measured from `total`; the grid has no
 * scrollbar to be honest with, so it says it in words and hands over the rest when asked.
 *
 * **The states are the work, not the happy path** (`UI-10a`, `UI-10b`, `UI-10c`). Two empty states
 * that have to stay different, skeletons at whichever density is on screen, an error that leaves
 * the player alone, and a read-only version of the screen that has to look intentional rather
 * than broken.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { useKeyboard } from '@/app/use-keyboard';
import { isFiltered, useUrlState } from '@/app/url-state';
import { Button, StateCard } from '@/design-system';
import { useAfterPaint } from '@/app/hooks/use-after-paint';
import * as format from '@/i18n/format';

import { LibraryFilters } from './LibraryFilters';
import { ListFailed, Loading, NothingMatched, NothingYet } from './LibraryStates';
import { LibraryHeader } from './LibraryHeader';
import { BulkReport, LibraryBulkBar } from './LibraryBulkBar';
import { RecordingGrid } from './RecordingGrid';
import { RecordingList } from './RecordingList';
import { useLibrary } from './data';
import { libraryQuery, useCategories, useRecordings } from './recordings';
import { EMPTY, coverage, extendTo, retain, selectAll, toggle } from './selection';
import { useBulk } from './use-bulk';

export function LibraryView() {
  const { uuid = '' } = useParams();
  const context = useLibrary(uuid);
  const { filters, clear } = useUrlState();
  const categories = useCategories(uuid);
  const painted = useAfterPaint();
  // Both densities are handed the filters alone: the grid accumulates pages behind this, and the
  // dense list windows over the whole library itself.
  const recordings = useRecordings(uuid, libraryQuery(filters));
  const [selection, setSelection] = useState(EMPTY);
  const bulk = useBulk(uuid);

  // `Esc` clears the selection (§1.8). The shell answers the same command for a dialog, a sheet
  // and a popover; a view answers it for the thing a view owns, and `useKeyboard` ignores a
  // command nobody has claimed -- so this is only bound while there is a selection to clear.
  useKeyboard(
    selection.selected.size > 0
      ? {
          dismiss: () => {
            setSelection(EMPTY);
          },
        }
      : {},
  );

  // The order a range is measured in is the order on screen (`UI-9d`), which is as far as either
  // density has fetched rather than the whole library.
  const order = recordings.items.map((recording) => recording.uuid);

  if (context.error !== null && context.error !== undefined) {
    return <Unavailable error={context.error} onRetry={context.refetch} />;
  }

  const libraryName = context.library?.name ?? '';
  // Absent rather than disabled: a library you can only read has no checkboxes (§3.5).
  const selectable = context.canEdit
    ? {
        selected: selection.selected,
        onToggle: (one: string, extend: boolean) => {
          setSelection((was) => (extend ? extendTo(was, one, order) : toggle(was, one)));
        },
      }
    : undefined;

  /**
   * Which of the six things this screen can be.
   *
   * The order is the one that keeps the two empty states apart: a library with nothing in it is
   * asked about before the filter is, because `total` is zero either way and only the filter
   * tells them apart (§3.5).
   */
  function body() {
    if (recordings.error !== null) {
      return <ListFailed error={recordings.error} onRetry={recordings.refetch} />;
    }
    if (recordings.isPending) return <Loading dense={filters.view === 'list'} />;
    if (recordings.items.length === 0) {
      return isFiltered(filters) ? (
        <NothingMatched
          total={context.library?.audio_count ?? 0}
          filters={filters}
          onClear={clear}
        />
      ) : (
        <NothingYet canEdit={context.canEdit} />
      );
    }
    if (filters.view === 'list') {
      return (
        <RecordingList
          libraryUuid={uuid}
          categories={categories}
          query={libraryQuery(filters)}
          libraryName={libraryName}
          {...(selectable === undefined ? {} : { selection: selectable })}
        />
      );
    }
    return (
      <>
        <RecordingGrid
          recordings={recordings.items}
          categories={categories}
          libraryName={libraryName}
          waveforms={painted}
          {...(selectable === undefined ? {} : { selection: selectable })}
        />
        <MoreRecordings
          shown={recordings.items.length}
          total={recordings.total}
          hasMore={recordings.hasMore}
          loading={recordings.isFetchingMore}
          settling={recordings.isPlaceholder}
          onMore={recordings.fetchMore}
        />
      </>
    );
  }

  return (
    <section>
      <LibraryHeader context={context} />
      {selection.selected.size > 0 ? (
        <LibraryBulkBar
          count={selection.selected.size}
          allSelected={coverage(selection, order)}
          onSelectAll={(on) => {
            setSelection((was) => selectAll(was, order, on));
          }}
          onClear={() => {
            setSelection(EMPTY);
          }}
          selected={recordings.items.filter((one) => selection.selected.has(one.uuid))}
          categories={categories.all}
          bulk={bulk}
          onOutcome={(outcome) => {
            // What is left selected is what did not succeed, so Retry is one click rather than a
            // reconstruction of what somebody had picked (`UI-9c`).
            setSelection((was) =>
              retain(
                was,
                outcome.failed.map((failure) => failure.uuid),
              ),
            );
          }}
        />
      ) : (
        <LibraryFilters categories={categories.all} />
      )}
      {/* Outside the swap above: a run that succeeded entirely leaves nothing selected, and a
          report inside the bulk bar would disappear at the moment it had something to say. */}
      {bulk.outcome !== null && <BulkReport bulk={bulk} />}
      {body()}
    </section>
  );
}

/**
 * A library that is not there, a library that is not yours, and an instance that never answered.
 *
 * The first two are one state and have to stay one state: the ACL refuses with 404 so that a 403
 * cannot confirm a recording exists (`DEC-14`), which means "it may have been deleted, or it may
 * never have been yours" is the whole of what this screen knows. It must never write "you do not
 * have permission" -- that sentence would give away exactly what the 404 exists to withhold.
 */
function Unavailable({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation('library');
  const problem = isApiProblem(error) ? error : undefined;

  if (problem?.isMissing === true) {
    return <StateCard icon="library" title={t('missing.title')} body={t('missing.body')} />;
  }

  const offline = problem?.isUnreachable ?? false;
  return (
    <StateCard
      icon="alert-circle"
      title={offline ? t('unreachable.title') : t('error.title')}
      body={offline ? t('common:state.offline') : (problem?.detail ?? t('error.title'))}
      action={
        <Button variant="secondary" onClick={onRetry}>
          {t('common:action.retry')}
        </Button>
      }
    />
  );
}

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
function MoreRecordings({
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
