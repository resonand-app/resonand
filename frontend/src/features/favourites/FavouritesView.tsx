/**
 * Favourites (`UI-44`).
 *
 * Every recording the caller has marked and can still read, whichever library it sits in. It is a
 * destination and not a library: a library is the unit of ownership and of permission, and these
 * recordings keep their own -- which is why each card and row names the library it lives in, and
 * why the bulk bar asks every recording selected what it allows (`rules.ts`).
 *
 * **It is the library view's machinery over a different source.** The grid, the dense list, the
 * filter bar, the bulk bar and the end-of-grid count are the library's, handed every recording
 * rather than one library's (`UI-43`), so the two cannot drift into drawing a recording two ways.
 * What differs is the filter bar without a category tree -- a category belongs to one library --
 * and a sort that starts from when each was marked, newest first.
 *
 * **Unmarking a card here does not take it away.** The heart empties and the card stays where it
 * is until the list is next fetched, so the same click undoes a mistaken one; removing it at once
 * would reflow the grid under the pointer. The bulk bar's unmark is different and meant to be: a
 * run over a selection ends in a report and a refetch, as every bulk action does.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { useAfterPaint } from '@/app/hooks/use-after-paint';
import { useIsPhone } from '@/app/hooks/use-is-phone';
import { useAllLibraries } from '@/app/library-data';
import { useKeyboard } from '@/app/use-keyboard';
import { SortDefaults, isFiltered, useUrlState } from '@/app/url-state';
import type { Filters, ViewSorts } from '@/app/url-state';
import { Button, PageHeader, StateCard } from '@/design-system';
import { LibraryFilters } from '@/features/library/LibraryFilters';
import { ListFailed, Loading } from '@/features/library/LibraryStates';
import { BulkReport, LibraryBulkBar } from '@/features/library/LibraryBulkBar';
import { MoreRecordings } from '@/features/library/MoreRecordings';
import { RecordingGrid } from '@/features/library/RecordingGrid';
import { RecordingList } from '@/features/library/RecordingList';
import {
  EVERYWHERE,
  fetchEveryRecording,
  useCategories,
  useRecordings,
} from '@/features/library/recordings';
import type { Recording } from '@/features/library/recordings';
import { EMPTY, coverage, extendTo, retain, selectAll, toggle } from '@/features/library/selection';
import { useBulk } from '@/features/library/use-bulk';
import { useStickyHeader } from '@/features/library/use-sticky-header';

import { rulesFor } from './rules';

/** Newest mark first, and every sort a library has besides. */
const FAVOURITES: ViewSorts = {
  sort: 'favourited_at',
  sorts: ['favourited_at', 'recorded_at', 'created_at', 'title', 'duration_ms'],
};

export function FavouritesView() {
  return (
    <SortDefaults value={FAVOURITES}>
      <Favourites />
    </SortDefaults>
  );
}

/** What the API is asked for, from what the URL says. A category in the URL is not one of them. */
function favouritesQuery(filters: Filters): Record<string, unknown> {
  return {
    favourite: true,
    ...(filters.tags.length > 0 ? { tag: filters.tags } : {}),
    ...(filters.states.length > 0 ? { transcription_state: filters.states } : {}),
    sort: filters.sort,
    direction: filters.direction,
  };
}

function Favourites() {
  const { t } = useTranslation('favourites');
  const { filters, clear } = useUrlState();
  const painted = useAfterPaint();
  const isPhone = useIsPhone();
  const query = favouritesQuery(filters);
  const recordings = useRecordings(EVERYWHERE, query);
  const counted = useQuery({
    queryKey: keys.everyRecording({ favourite: true, limit: 1 }),
    queryFn: () => get('/api/audio', { query: { favourite: true, limit: 1 } }),
  });
  const [selection, setSelection] = useState(EMPTY);
  const bulk = useBulk();
  const [stickyRef, headerHeight] = useStickyHeader();
  const [everything, setEverything] = useState<{ query: string; items: Recording[] } | null>(null);
  const queryKey = JSON.stringify(query);
  const pool = useMemo(
    () => (everything?.query === queryKey ? everything.items : recordings.items),
    [everything, queryKey, recordings.items],
  );
  const readable = new Set(useAllLibraries().map((one) => one.uuid));
  const selected = pool.filter((one) => selection.selected.has(one.uuid));
  const rules = rulesFor(selected, readable);
  const categories = useCategories(rules.canEdit ? (rules.library ?? '') : '');

  useKeyboard(
    selection.selected.size > 0
      ? {
          dismiss: () => {
            setSelection(EMPTY);
          },
        }
      : {},
  );

  const order = recordings.items.map((recording) => recording.uuid);
  const dense =
    filters.view === 'list' &&
    recordings.error === null &&
    !recordings.isPending &&
    recordings.items.length > 0;
  const fills = dense && !isPhone;
  // Every favourite is readable, so every one can at least be unmarked from a selection.
  const selectable = {
    selected: selection.selected,
    onToggle: (one: string, extend: boolean) => {
      setSelection((was) => (extend ? extendTo(was, one, order) : toggle(was, one)));
    },
  };

  function body() {
    if (recordings.error !== null) {
      return <ListFailed error={recordings.error} onRetry={recordings.refetch} />;
    }
    if (recordings.isPending) return <Loading dense={filters.view === 'list'} />;
    if (recordings.items.length === 0) {
      return isFiltered(filters) ? (
        <StateCard
          icon="search"
          title={t('nothingMatched.title')}
          body={t('nothingMatched.body')}
          action={
            <Button variant="secondary" onClick={clear}>
              {t('nothingMatched.clear')}
            </Button>
          }
        />
      ) : (
        <StateCard icon="heart" title={t('empty.title')} body={t('empty.body')} />
      );
    }
    if (filters.view === 'list') {
      return (
        <RecordingList
          source={EVERYWHERE}
          query={query}
          headerOffset={`${String(headerHeight)}px`}
          fills={fills}
          selection={selectable}
        />
      );
    }
    return (
      <>
        <RecordingGrid recordings={recordings.items} waveforms={painted} selection={selectable} />
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
    <section
      {...(fills ? { 'data-fills': '' } : {})}
      style={
        fills ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : undefined
      }
    >
      <PageHeader
        title={t('title')}
        {...(counted.data === undefined
          ? {}
          : { meta: t('common:count.recordings', { count: counted.data.total }) })}
      />
      <div
        ref={stickyRef}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 'var(--z-player)',
          display: 'flow-root',
          background: 'var(--bg)',
        }}
      >
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
            matching={recordings.total}
            onSelectEverything={() => {
              void fetchEveryRecording(EVERYWHERE, query).then((items) => {
                setEverything({ query: queryKey, items });
                setSelection({ selected: new Set(items.map((one) => one.uuid)), anchor: null });
              });
            }}
            selected={selected}
            categories={rules.canEdit && rules.library !== undefined ? categories.all : undefined}
            canEdit={rules.canEdit}
            canMove={rules.canMove}
            canTrash={rules.canTrash}
            bulk={bulk}
            onOutcome={(outcome) => {
              setSelection((was) =>
                retain(
                  was,
                  outcome.failed.map((failure) => failure.uuid),
                ),
              );
            }}
          />
        ) : (
          <LibraryFilters />
        )}
      </div>
      {bulk.outcome !== null && <BulkReport bulk={bulk} />}
      {body()}
    </section>
  );
}
