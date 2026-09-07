import type { ButtonHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The glyph. */
  icon: IconName;
  /**
   * `filled` is the default chrome control, `ghost` the quiet one, `accent` the player's play
   * button and `accent-soft` a card's.
   *
   * **The last two were inline `style` overrides until `UI-32a`.** `PlayerBar` and
   * `RecordingCard` each passed a `background` through `style`, which is a paint no hover rule
   * can reach past -- so the two play controls in the product were the two controls that did not
   * respond to a pointer. Naming them is what fixes that.
   */
  variant?: 'filled' | 'ghost' | 'accent' | 'accent-soft';
  /** Visual diameter in px. 32 default, 38 for the player's play control. */
  size?: number;
  /** Required -- the control has no visible label. */
  label: string;
  /** Renders the accent-soft fill for the current nav destination or an engaged toggle. */
  active?: boolean;
}

/**
 * A round icon-only control.
 *
 * The visual is 32px and the hit target is 44, grown by the `data-hit-target` pseudo-element in
 * `components.css` rather than by growing the box, so a row of them keeps its rhythm (`UI-32b`).
 * `label` is required and not optional-with-a-default, because a control with no visible text and
 * no accessible name is one that cannot be used at all by somebody who is not looking at it.
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
  return (
    <button
      type="button"
      aria-label={label}
      data-ds="icon-button"
      data-variant={variant}
      data-active={active === true ? 'true' : undefined}
      data-hit-target=""
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: 'none',
        borderRadius: 'var(--radius-circle)',
        display: 'grid',
        placeItems: 'center',
        transition: 'background var(--transition-state), color var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} />
    </button>
  );
}
