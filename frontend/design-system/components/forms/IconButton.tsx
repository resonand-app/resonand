import type { ButtonHTMLAttributes, CSSProperties } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The glyph. */
  icon: IconName;
  variant?: 'filled' | 'ghost';
  /** Visual diameter in px. 32 default, 38 for the player's play control. */
  size?: number;
  /** Required -- the control has no visible label. */
  label: string;
  /** Renders the accent-soft active fill (current nav destination, engaged toggle). */
  active?: boolean;
}

/**
 * A round icon-only control.
 *
 * The visual is 32px and the hit target is 44 (`UI-32b` grows it with a pseudo-element rather
 * than by growing the box). `label` is required and not optional-with-a-default, because a
 * control with no visible text and no accessible name is one that cannot be used at all by
 * somebody who is not looking at it.
 */
export function IconButton({
  icon,
  variant = 'filled',
  size = 32,
  label,
  active,
  style,
  ...rest
}: IconButtonProps) {
  const fill: CSSProperties = active
    ? { background: 'var(--accent-soft)', color: 'var(--accent-on-soft)' }
    : variant === 'filled'
      ? { background: 'var(--surface-2)', color: 'var(--text-2)' }
      : { background: 'transparent', color: 'var(--text-3)' };

  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: 'none',
        borderRadius: 'var(--radius-circle)',
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        transition: 'background var(--transition-state), color var(--transition-state)',
        ...fill,
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} />
    </button>
  );
}
