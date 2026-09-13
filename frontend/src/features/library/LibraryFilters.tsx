/**
 * The row under a library's header (`UI-8a`, §V3).
 *
 * One row, not a second rail. §V3 is explicit about why: a permanent rail drops the card grid from
 * three columns to two at 1280, which is a lot of chrome for a family archive, and a popover is
 * the only form that also collapses honestly onto a phone (`UI-8e`).
 *
 * **Everything here writes to the URL** (`UI-4b`, §2.1). A filtered library is a thing somebody
 * links to and reloads into, and a filter that vanished on refresh is a filter nobody trusts
 * enough to use. `useUrlState` owns the shape; this row only decides which of its controls a
 * library needs.
 *
 * Four controls: the category tree (`UI-8a`), the tags (`UI-8b`), the four transcription states
 * (`UI-8c`), and the sort with the density switch at the other end of the row (`UI-8d`).
 *
 * **On a phone the whole bar collapses into one button and a sheet** (`UI-8e`, §V3). Not a
 * narrowed row: four controls that wrap onto three lines would be most of a 375px screen before
 * a recording is drawn. The button carries a count of what is on, because a filter somebody
 * cannot see is a filter they will forget they set -- and it is the same controls inside, in the
 * same order, so the phone and the desktop are one screen at two widths rather than two screens.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsPhone } from '@/app/hooks/use-is-phone';
import { isFiltered, useUrlState } from '@/app/url-state';
import { FilterBar } from '@/components/FilterBar';
import { Button, Sheet } from '@/design-system';

import { CategoryPicker } from './CategoryPicker';
import { SortControl, ViewSwitch } from './SortControl';
import { StateToggles } from './StateToggles';
import { TagPicker } from './TagPicker';
import type { Category } from './recordings';

export interface LibraryFiltersProps {
  categories: readonly Category[];
  /** What the right-hand end says: the count, or how many a filter matched. */
  meta?: string;
}

export function LibraryFilters({ categories, meta }: LibraryFiltersProps) {
  const { t } = useTranslation('library');
  const { filters, set } = useUrlState();
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(false);

  const controls = (
    <>
      <CategoryPicker
        categories={categories}
        value={filters.categoryId}
        onChange={(categoryId) => {
          set({ categoryId });
        }}
      />
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

  const sort = (
    <SortControl
      sort={filters.sort}
      direction={filters.direction}
      onSort={(field, direction) => {
        set({ sort: field, direction });
      }}
    />
  );

  const view = (
    <ViewSwitch
      value={filters.view}
      onChange={(next) => {
        set({ view: next });
      }}
    />
  );

  if (isPhone) {
    // How many things are narrowing the list. A category counts once, and so does each tag and
    // each state -- it is a count of decisions somebody made, not of parameters in a URL.
    const active =
      (filters.categoryId === undefined ? 0 : 1) + filters.tags.length + filters.states.length;

    return (
      <>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Button
            variant="secondary"
            icon="sliders-horizontal"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            {active > 0 ? t('filters.someOn', { count: active }) : t('filters.open')}
          </Button>
          <div style={{ flex: 1 }} />
          {view}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>{sort}</div>
          {isFiltered(filters) && (
            <Button
              variant="ghost"
              onClick={() => {
                set({ categoryId: undefined, tags: [], states: [] });
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
      {...(meta === undefined ? {} : { meta })}
      filters={controls}
      sort={sort}
      view={view}
    />
  );
}
