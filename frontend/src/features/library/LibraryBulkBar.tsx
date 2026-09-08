/**
 * What replaces the filter bar while a selection exists (`UI-9a`, §V3).
 *
 * A count and never a list of names: it has to survive a selection of two hundred, and two
 * hundred titles is a paragraph where a number belongs. `BulkBar` owns the row -- the same height
 * as `FilterBar`, so nothing moves when the first checkbox is ticked -- and this is what fills it.
 *
 * The four actions arrive with `UI-9b`. What is here now is the count, the select-all with its
 * mixed state, and the way out, which is the part of a selection somebody needs first.
 */

import { BulkBar } from '@/components/BulkBar';

export interface LibraryBulkBarProps {
  count: number;
  allSelected: boolean | 'mixed';
  onSelectAll: (selected: boolean) => void;
  onClear: () => void;
}

export function LibraryBulkBar({ count, allSelected, onSelectAll, onClear }: LibraryBulkBarProps) {
  return (
    <BulkBar count={count} allSelected={allSelected} onSelectAll={onSelectAll} onClear={onClear} />
  );
}
