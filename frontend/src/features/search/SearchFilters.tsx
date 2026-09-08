/**
 * The same filter bar as a library's, one level up (`UI-16c`, §V6).
 *
 * V3 narrows one library; this narrows everything somebody has ever recorded. The controls are
 * deliberately the same ones in the same order -- `FilterBar` is the shell both use, the tag
 * picker and the state toggles are literally the same components -- because a person who has
 * learned to filter a library has learned to filter a search.
 *
 * **Three controls only search has**: which library, when the recording was made, and how long it
 * is. All three exist here for the same reason: a search over three hundred recordings needs a way
 * to say "the ones from that summer" that a single library's grid does not.
 *
 * **The category picker appears once a library is chosen, and not before.** Categories belong to
 * the library they were made in -- two libraries can both have a `Casa`, and they are different
 * categories with different ids -- so a category filter with no library is a filter on a number
 * that means nothing across the archive. Offering it and having it match one library's recordings
 * by coincidence would be worse than not offering it.
 *
 * **There is no sort.** Results come back ranked by how well they match, and a control that
 * reordered them by date would be one that silently discards the ranking that made them results.
 * That is why `FilterBar`'s sort and view slots are empty here rather than filled with V3's.
 *
 * **The four state toggles are all four** (`JOB-11b`). Search took `none` or `done` and nothing
 * else until the filter was widened; two of the toggles could not honestly be drawn before that.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsPhone } from '@/app/use-is-phone';
import { isFiltered, useUrlState } from '@/app/url-state';
import { FilterBar } from '@/components/FilterBar';
import { CategoryPicker } from '@/features/library/CategoryPicker';
import { StateToggles } from '@/features/library/StateToggles';
import { TagPicker } from '@/features/library/TagPicker';
import { useCategories } from '@/features/library/recordings';

import { useReadableLibraries } from './data';
import { Button, Select, Sheet, TextField, useAnchoredOverlay } from '@/design-system';
import type { SelectOption } from '@/design-system';

/** Durations are asked for in minutes and sent in milliseconds. Nobody types 1 800 000. */
const MINUTE = 60_000;

export function SearchFilters() {
  const { t } = useTranslation('search');
  const { filters, set, clear } = useUrlState();
  const libraryList = useReadableLibraries();
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [rangesOpen, setRangesOpen] = useState(false);
  const range = useAnchoredOverlay<HTMLButtonElement>({
    open: rangesOpen,
    onClose: () => {
      setRangesOpen(false);
    },
    placement: 'bottom',
    align: 'start',
  });
  const { anchorRef, surfaceRef, surfaceStyle, id } = range;
  // Only the chosen library's categories, and none at all until there is one.
  const categories = useCategories(filters.library ?? '');

  // How many of the four range fields are set. The button says so, because a filter somebody
  // cannot see is a filter they will forget they set -- and these four are behind a popover.
  const rangeCount = [
    filters.recordedFrom,
    filters.recordedTo,
    filters.minDurationMs,
    filters.maxDurationMs,
  ].filter((one) => one !== undefined).length;

  const libraries: SelectOption[] = [
    { value: '', label: t('filters.anyLibrary') },
    ...libraryList.map((library) => ({ value: library.uuid, label: library.name })),
  ];

  const controls = (
    <>
      <Select
        value={filters.library ?? ''}
        options={libraries}
        ariaLabel={t('filters.library')}
        onChange={(uuid) => {
          // A category id is only meaningful inside the library it belongs to, so changing the
          // library drops it rather than carrying a number into a place it does not name anything.
          set({ library: uuid === '' ? undefined : uuid, categoryId: undefined });
        }}
      />
      {filters.library !== undefined && (
        <CategoryPicker
          categories={categories.all}
          value={filters.categoryId}
          onChange={(categoryId) => {
            set({ categoryId });
          }}
        />
      )}
      <TagPicker
        value={filters.tags}
        onChange={(tags) => {
          set({ tags });
        }}
      />
      <StateToggles
        value={filters.states}
        onChange={(states) => {
          set({ states });
        }}
      />
    </>
  );

  // The two ranges, which are four fields and need their labels: a bare pair of date boxes is a
  // pair of date boxes nobody can tell apart at a glance. Four labelled fields is also two rows of
  // chrome, which is why the desktop bar keeps them in a popover and the phone sheet does not --
  // a sheet is already a surface somebody opened on purpose.
  const ranges = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
      <TextField
        type="date"
        label={t('filters.recordedFrom')}
        value={filters.recordedFrom ?? ''}
        onChange={(event) => {
          set({ recordedFrom: event.target.value || undefined });
        }}
      />
      <TextField
        type="date"
        label={t('filters.recordedTo')}
        value={filters.recordedTo ?? ''}
        onChange={(event) => {
          set({ recordedTo: event.target.value || undefined });
        }}
      />
      <TextField
        type="number"
        min={0}
        label={t('filters.longerThan')}
        value={minutesOf(filters.minDurationMs)}
        onChange={(event) => {
          set({ minDurationMs: millisecondsOf(event.target.value) });
        }}
      />
      <TextField
        type="number"
        min={0}
        label={t('filters.shorterThan')}
        value={minutesOf(filters.maxDurationMs)}
        onChange={(event) => {
          set({ maxDurationMs: millisecondsOf(event.target.value) });
        }}
      />
    </div>
  );

  if (isPhone) {
    // A count of decisions somebody made, not of parameters in a URL -- the same arithmetic the
    // library's phone bar does, because it is the same question.
    const active =
      (filters.library === undefined ? 0 : 1) +
      (filters.categoryId === undefined ? 0 : 1) +
      rangeCount +
      filters.tags.length +
      filters.states.length;

    return (
      <>
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Button
            variant="secondary"
            icon="sliders-horizontal"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            {active > 0 ? t('filters.someOn', { count: active }) : t('filters.open')}
          </Button>
        </div>
        <Sheet
          open={sheetOpen}
          onClose={() => {
            setSheetOpen(false);
          }}
          title={t('filters.title')}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 'var(--space-2)',
            }}
          >
            {controls}
          </div>
          {ranges}
          {isFiltered(filters) && (
            <Button
              variant="ghost"
              onClick={() => {
                clear();
                setSheetOpen(false);
              }}
            >
              {t('filters.clear')}
            </Button>
          )}
        </Sheet>
      </>
    );
  }

  return (
    <FilterBar
      filters={
        <>
          {controls}
          <Button
            ref={anchorRef}
            variant="ghost"
            icon="clock"
            aria-expanded={rangesOpen}
            aria-haspopup="true"
            onClick={() => {
              setRangesOpen((was) => !was);
            }}
          >
            {rangeCount === 0 ? t('filters.ranges') : t('filters.rangesOn', { count: rangeCount })}
          </Button>
          {rangesOpen && (
            <div
              ref={surfaceRef}
              id={id}
              style={{
                ...surfaceStyle,
                zIndex: 'var(--z-menu)',
                width: 300,
                padding: 'var(--space-3)',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-panel)',
                boxShadow: 'var(--elevation-overlay)',
              }}
            >
              {ranges}
            </div>
          )}
        </>
      }
    />
  );
}

function minutesOf(ms: number | undefined): string {
  return ms === undefined ? '' : String(Math.round(ms / MINUTE));
}

function millisecondsOf(typed: string): number | undefined {
  const minutes = Number(typed);
  if (typed.trim() === '' || !Number.isFinite(minutes) || minutes < 0) return undefined;
  return Math.round(minutes * MINUTE);
}
