import type { ReactNode } from 'react';

export interface FilterBarProps {
  /**
   * The filter controls themselves: chips for the transcription states, a category `Select`, a
   * tag picker. Passed in, because V3, V4 and V6 filter different things.
   */
  filters?: ReactNode;
  /** The sort control. A `Select`, and the same one in all three views. */
  sort?: ReactNode;
  /** Cards or dense list. Two `IconButton`s in V3 and V4; absent in search. */
  view?: ReactNode;
  /** The count, or anything else that belongs at the right-hand end. */
  meta?: ReactNode;
}

/**
 * The bar above a list: filters, then a divider, then sort and the view switch (`UI-35g`).
 *
 * **The shell only.** What goes in it is different in each of the three views that use it -- V3
 * filters a library by state and tag, V4 adds a column sort, V6 filters a search across everything
 * -- and a component that knew all three would be a component that grows a prop per view. It owns
 * the row: the wrap behaviour, the gap, the divider, and the fact that sort and the view switch
 * are at the other end from the filters.
 *
 * It is an application component and not part of the design system (`DEC-22`): it is assembled
 * from `Chip`, `Select` and `IconButton`, and the things it will hold -- a tag list, a category
 * tree -- come from queries. The line is that the system draws controls and the application knows
 * what they are for.
 *
 * `BulkBar` replaces it while a selection exists rather than sitting beside it, which is why both
 * are the same height: the row must not move when the first checkbox is ticked.
 */
export function FilterBar({ filters, sort, view, meta }: FilterBarProps) {
  return (
    <div
      style={{
        minHeight: 'var(--hit-target)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          minWidth: 0,
        }}
      >
        {filters}
      </div>
      <div style={{ flex: 1, minWidth: 'var(--space-4)' }} />
      {meta !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-numeric-size)',
            fontVariantNumeric: 'var(--type-numeric-variant)',
            color: 'var(--text-3)',
          }}
        >
          {meta}
        </span>
      )}
      {(sort !== undefined || view !== undefined) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          {/* The divider is the only border in the row, and it is a divider inside a panel --
              which is the one thing the system's borders are for. */}
          <span
            style={{
              width: 'var(--border-hairline)',
              height: 20,
              background: 'var(--hairline)',
            }}
          />
          {sort}
          {view}
        </div>
      )}
    </div>
  );
}
