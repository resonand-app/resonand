/**
 * The sort, and the two densities (`UI-8d`, §V3, §V4).
 *
 * **One sort, expressed two ways.** This control and the dense list's column headings (`UI-7d`)
 * write the same two URL parameters, so clicking a heading and choosing here are indistinguishable
 * in effect -- which is what §V4 asks for, and is only true because neither of them holds a sort
 * of its own.
 *
 * Four fields and a direction, not eight options. `Recorded, newest first` and `Recorded, oldest
 * first` as separate rows would be eight rows to read, and the direction is the thing somebody
 * flips most often -- so it is its own control.
 *
 * **The glyph says which way the list currently runs; the name says what pressing will do.** A
 * button labelled with its own current state is a button nobody can predict: "newest first" could
 * as easily mean "it is" as "make it".
 *
 * The view switch is here rather than beside the filters because it is not a filter: it changes
 * how the same recordings are drawn, and it lives at the sort's end of the bar for that reason.
 */

import { useTranslation } from 'react-i18next';

import { IconButton, Select } from '@/design-system';
import type { SelectOption } from '@/design-system';
import type { SortDirection, SortField, ViewMode } from '@/app/url-state';

export interface SortControlProps {
  sort: SortField;
  direction: SortDirection;
  onSort: (sort: SortField, direction: SortDirection) => void;
}

/** The four the API offers, in the order the control lists them (`API-10`). */
const FIELDS: readonly SortField[] = ['recorded_at', 'created_at', 'duration_ms', 'title'];

export function SortControl({ sort, direction, onSort }: SortControlProps) {
  const { t } = useTranslation('library');
  const options: SelectOption<SortField>[] = FIELDS.map((field) => ({
    value: field,
    label: t(`sort.${field}`),
  }));

  return (
    <>
      <Select<SortField>
        value={sort}
        options={options}
        ariaLabel={t('sort.label')}
        onChange={(field) => {
          onSort(field, direction);
        }}
      />
      <IconButton
        icon={direction === 'desc' ? 'chevron-down' : 'chevron-up'}
        variant="ghost"
        size={32}
        label={t(direction === 'desc' ? 'sort.toAscending' : 'sort.toDescending')}
        onClick={() => {
          onSort(sort, direction === 'desc' ? 'asc' : 'desc');
        }}
      />
    </>
  );
}

export interface ViewSwitchProps {
  value: ViewMode;
  onChange: (view: ViewMode) => void;
}

export function ViewSwitch({ value, onChange }: ViewSwitchProps) {
  const { t } = useTranslation('library');
  return (
    <div role="group" aria-label={t('view.label')} style={{ display: 'flex', gap: 2 }}>
      <IconButton
        icon="layout-grid"
        variant={value === 'grid' ? 'accent-soft' : 'ghost'}
        size={32}
        aria-pressed={value === 'grid'}
        label={t('view.grid')}
        onClick={() => {
          onChange('grid');
        }}
      />
      <IconButton
        icon="rows"
        variant={value === 'list' ? 'accent-soft' : 'ghost'}
        size={32}
        aria-pressed={value === 'list'}
        label={t('view.list')}
        onClick={() => {
          onChange('list');
        }}
      />
    </div>
  );
}
