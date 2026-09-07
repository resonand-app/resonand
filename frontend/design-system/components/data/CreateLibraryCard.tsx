import type { ButtonHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export interface CreateLibraryCardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The copy, for an application that has its own (`UI-22a`).
   *
   * The defaults are English, because a tile with no words in it is a tile that draws an empty
   * box in a specimen. But every literal a person reads has to be replaceable from outside the
   * system -- the interface externalises all of its copy, and a string baked in here would be one
   * that can never be translated.
   */
  labels?: {
    action?: string;
    hint?: string;
  };
}

/**
 * The first tile in the library grid: the same footprint as a library card, and no elevation.
 *
 * It does not float, because it is not a thing yet -- so its hover is a surface step and not an
 * elevation one (`UI-32a`). The copy says what the next screen will ask for rather than describing
 * the button: "Name it and pick a colour" is the whole of the create dialog, stated before it
 * opens.
 */
export function CreateLibraryCard({ labels, onClick, style, ...rest }: CreateLibraryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-ds="create-library-card"
      style={{
        width: '100%',
        height: 'var(--card-height)',
        border: 'none',
        borderRadius: 'var(--radius-panel)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
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
      <span
        style={{
          fontSize: 'var(--type-body-size)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--accent)',
        }}
      >
        {labels?.action ?? 'Create a library'}
      </span>
      <span style={{ fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
        {labels?.hint ?? 'Name it and pick a colour'}
      </span>
    </button>
  );
}
