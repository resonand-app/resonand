import type { ButtonHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export type CreateLibraryCardProps = ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The first tile in the library grid: the same footprint as a library card, and no elevation.
 *
 * It does not float, because it is not a thing yet. The copy says what the next screen will ask
 * for rather than describing the button -- "Name it and pick a colour" is the whole of the create
 * dialog, stated before it opens.
 */
export function CreateLibraryCard({ onClick, style, ...rest }: CreateLibraryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        height: 'var(--card-height)',
        border: 'none',
        background: 'var(--empty-fill)',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-circle)',
          background: 'var(--accent-soft)',
          color: 'var(--accent-on-soft)',
        }}
      >
        <Icon name="plus" size={19} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Create a library</span>
      <span style={{ fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
        Name it and pick a colour
      </span>
    </button>
  );
}
