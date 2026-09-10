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
 * **The states are the work, not the happy path** (`UI-10a`, `UI-10b`, `UI-10c`). Two empty states
 * that have to stay different, skeletons at whichever density is on screen, an error that leaves
 * the player alone, and a read-only version of the screen that has to look intentional rather
 * than broken.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { PAGE_SIZE } from '@/api/paged';
import { useKeyboard } from '@/app/useKeyboard';
import { isFiltered, useUrlState } from '@/app/url-state';
import { Button, StateCard } from '@/design-system';
import { useAfterPaint } from '@/app/use-after-paint';

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
  // The grid takes one page; the dense list windows over the whole library and so is handed the
  // filters without a window of their own.
  const recordings = useRecordings(uuid, libraryQuery(filters, { limit: PAGE_SIZE, offset: 0 }));
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

  // The order a range is measured in is the order on screen (`UI-9d`). The grid has its page; the
  // dense list windows over the whole library, so a range there spans what has been fetched.
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
      return (
        <ListFailed
          error={recordings.error}
          onRetry={() => {
            void recordings.refetch();
          }}
        />
      );
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
    return filters.view === 'list' ? (
      <RecordingList
        libraryUuid={uuid}
        categories={categories}
        query={libraryQuery(filters)}
        libraryName={libraryName}
        {...(selectable === undefined ? {} : { selection: selectable })}
      />
    ) : (
      <RecordingGrid
        recordings={recordings.items}
        categories={categories}
        libraryName={libraryName}
        waveforms={painted}
        {...(selectable === undefined ? {} : { selection: selectable })}
      />
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
