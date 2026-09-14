import type { ButtonHTMLAttributes, Ref } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The control itself, for an overlay that has to be anchored to it.
   *
   * Declared here for the reason `Button` declares it: `ButtonHTMLAttributes` does not carry it,
   * so without this line a caller passing one is a type error rather than a working anchor.
   */
  ref?: Ref<HTMLButtonElement>;
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
  /**
   * Renders an `<a>` with the control's shape, for a navigation the browser performs itself.
   *
   * `Button` carries the same pair and for the same reason: a download is a navigation, and one
   * expressed as a link can be opened in a new tab, saved from the context menu, and needs no
   * fetch, no blob and no progress the interface would have to invent.
   */
  href?: string;
  /** Saves the target rather than opening it. Only meaningful beside `href`. */
  download?: boolean;
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
  href,
  download,
  style,
  ...rest
}: IconButtonProps) {
  const shape = {
    'aria-label': label,
    'data-variant': variant,
    'data-active': active === true ? 'true' : undefined,
    'data-hit-target': '',
    style: {
      width: size,
      height: size,
      minWidth: size,
      border: 'none',
      borderRadius: 'var(--radius-circle)',
      display: 'grid',
      placeItems: 'center',
      transition: 'background var(--transition-state), color var(--transition-state)',
      ...style,
    },
  };

  const glyph = <Icon name={icon} size={Math.round(size * 0.53)} />;

  // No `rest` on the anchor, as on `Button`: a button's handlers on a link are how a download
  // becomes something else.
  if (href !== undefined) {
    return (
      <a data-ds="icon-button" href={href} download={download} {...shape}>
        {glyph}
      </a>
    );
  }

  return (
    <button data-ds="icon-button" type="button" {...shape} {...rest}>
      {glyph}
    </button>
  );
}
