import type { ReactNode } from 'react';

import { Button, Checkbox } from '@/design-system';

export interface BulkBarProps {
  /** How many are selected. **A count, never a list of names.** */
  count: number;
  /** Whether every row in view is selected, or only some. Drives the header checkbox. */
  allSelected: boolean | 'mixed';
  onSelectAll: (selected: boolean) => void;
  /** Clears the selection. `Esc` does the same thing, and the view owns that key. */
  onClear: () => void;
  /** Move, re-transcribe, download, send to trash. Passed in: they differ per view. */
  actions?: ReactNode;
}

/**
 * The bar that replaces the filter bar while a selection exists (`UI-35h`).
 *
 * **A count, never names.** "12 recordings selected", not "Sopar de Nadal 1998, Entrevista amb
 * l'àvia Teresa and 10 others" -- because it has to survive 200 selected, and a bar that lists
 * what it can and truncates the rest is one that tells somebody less the more they have selected.
 * The names are on the rows, which are still on the screen and still ticked.
 *
 * It **replaces** the filter bar rather than appearing above it, and both are the same height, so
 * the list does not move when the first checkbox is ticked. Moving a list somebody is selecting
 * in is how the wrong recording gets selected.
 *
 * The bulk actions it holds have no bulk endpoint behind them (§3.5): 200 recordings is 200
 * requests, so partial failure is the normal outcome and `Toast` says what succeeded, what did
 * not, and leaves the failures selected -- which is the reason the selection is the view's state
 * and not this component's.
 */
export function BulkBar({ count, allSelected, onSelectAll, onClear, actions }: BulkBarProps) {
  return (
    <div
      style={{
        minHeight: 'var(--hit-target)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
        padding: '0 var(--space-3)',
        marginBottom: 'var(--space-4)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--accent-soft)',
      }}
    >
      <Checkbox
        checked={allSelected}
        onChange={onSelectAll}
        label={allSelected === true ? 'Clear the selection' : 'Select everything here'}
        size="row"
      />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          fontWeight: 'var(--weight-medium)',
          color: 'var(--accent-on-soft)',
        }}
      >
        {count} selected
      </span>
      <div style={{ flex: 1, minWidth: 'var(--space-4)' }} />
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        {actions}
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  );
}
