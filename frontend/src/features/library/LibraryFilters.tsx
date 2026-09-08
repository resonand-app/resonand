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
 * The controls arrive one task at a time: the category tree here, tags with `UI-8b`, the four
 * state toggles with `UI-8c`, and the sort and view switch with `UI-8d`.
 */

import { useUrlState } from '@/app/url-state';
import { FilterBar } from '@/components/FilterBar';

import { CategoryPicker } from './CategoryPicker';
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
        <CategoryPicker
          categories={categories}
          value={filters.categoryId}
          onChange={(categoryId) => {
            set({ categoryId });
          }}
        />
      }
    />
  );
}
