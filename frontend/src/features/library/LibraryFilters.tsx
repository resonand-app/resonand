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
 * (`UI-8c`), and the sort with the density switch at the other end of the row (`UI-8d`). The
 * phone collapses the whole bar into a sheet (`UI-8e`).
 */

import { useUrlState } from '@/app/url-state';
import { FilterBar } from '@/components/FilterBar';

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
  const { filters, set } = useUrlState();

  return (
    <FilterBar
      {...(meta === undefined ? {} : { meta })}
      filters={
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
      }
      sort={
        <SortControl
          sort={filters.sort}
          direction={filters.direction}
          onSort={(sort, direction) => {
            set({ sort, direction });
          }}
        />
      }
      view={
        <ViewSwitch
          value={filters.view}
          onChange={(view) => {
            set({ view });
          }}
        />
      }
    />
  );
}
