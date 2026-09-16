import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, IconButton } from '@/design-system';

export interface BulkBarProps {
  /** How many are selected. **A count, never a list of names.** */
  count: number;
  /** Whether every row in view is selected, or only some. Drives the header checkbox. */
  allSelected: boolean | 'mixed';
  onSelectAll: (selected: boolean) => void;
  /** Clears the selection. `Esc` does the same thing, and the view owns that key. */
  onClear: () => void;
  /**
   * How many rows the filter matches, which is more than are loaded in a long library.
   *
   * With `onSelectEverything`, it is what the second step of select-all offers and the number it
   * names. Left out, the bar offers the first step only.
   */
  matching?: number;
  /** Select every row the filter matches, not only the ones that have been fetched. */
  onSelectEverything?: () => void;
  /** Move, re-transcribe, download, send to trash. Passed in: they differ per view. */
  actions?: ReactNode;
}

/**
 * The bar that replaces the filter bar while a selection exists (`UI-35h`).
 *
 * **A count, never names.** "12 recordings selected", not "Digitised cassette, Field
 * recording, long take and 10 others" -- because it has to survive 200 selected, and a bar that lists
 * what it can and truncates the rest is one that tells somebody less the more they have selected.
 * The names are on the rows, which are still on the screen and still ticked.
 *
 * It **replaces** the filter bar rather than appearing above it, and both are the same height, so
 * the list does not move when the first checkbox is ticked. Moving a list somebody is selecting
 * in is how the wrong recording gets selected.
 *
 * **Select-all is two steps and a button, not only the checkbox.** The checkbox says what the
 * selection covers and has since `UI-35h`, but it is 16px of tri-state with no words on it, and
 * nobody found it. So the first step is a button that selects what is loaded, and the second --
 * offered only once the first is done, and only where there is more -- names the number it would
 * add: "Select all 812". Doing it in one step would be a button that silently means one of two
 * very different things depending on how far somebody had scrolled.
 *
 * **The actions are icons and the select-all is words.** Four labelled buttons and a picker did
 * not fit the row at 1280 with a sidebar out, and these four -- category, tag, move, trash -- are
 * the ones a glyph carries on its own. The number in "Select all 812" is the whole point of that
 * control and cannot be drawn, so it keeps its text and sits with the count rather than with them.
 *
 * The bulk actions it holds have no bulk endpoint behind them (§3.5): 200 recordings is 200
 * requests, so partial failure is the normal outcome and `Toast` says what succeeded, what did
 * not, and leaves the failures selected -- which is the reason the selection is the view's state
 * and not this component's.
 */
export function BulkBar({
  count,
  allSelected,
  onSelectAll,
  onClear,
  matching,
  onSelectEverything,
  actions,
}: BulkBarProps) {
  const { t } = useTranslation();
  const more =
    matching !== undefined && onSelectEverything !== undefined && matching > count
      ? matching
      : undefined;

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
        label={t(allSelected === true ? 'selection.clearAll' : 'selection.all')}
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
        {t('selection.count', { count })}
      </span>
      {allSelected === true ? (
        more !== undefined && (
          <Button variant="ghost" onClick={onSelectEverything}>
            {t('selection.everything', { total: more })}
          </Button>
        )
      ) : (
        <Button
          variant="ghost"
          onClick={() => {
            onSelectAll(true);
          }}
        >
          {t('selection.selectAll')}
        </Button>
      )}
      <div style={{ flex: 1, minWidth: 'var(--space-4)' }} />
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
      >
        {actions}
        <IconButton icon="x" variant="ghost" label={t('action.clear')} onClick={onClear} />
      </div>
    </div>
  );
}
