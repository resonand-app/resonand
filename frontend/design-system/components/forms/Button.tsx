import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * The button itself, for an overlay that has to be anchored to it (`UI-8a`).
   *
   * A plain prop rather than a `forwardRef`, which React 19 makes unnecessary -- and declared here
   * because `ButtonHTMLAttributes` does not carry it, so without this line a caller passing one
   * is a type error rather than a working anchor.
   */
  ref?: Ref<HTMLButtonElement>;
  /** primary for the one main action per view; ghost for Cancel; danger for destructive confirms. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Glyph rendered before the label. */
  icon?: IconName;
  /** Renders an `<a>` with the button's shape, for a navigation the browser performs itself. */
  href?: string;
  /** Saves the target rather than opening it. Only meaningful beside `href`. */
  download?: boolean;
  children?: ReactNode;
}

/**
 * The system's text button. Pill-shaped at every size.
 *
 * One primary per view: it is the same amber as a playing waveform and an active nav item, and
 * two of them on a screen means neither is the main action.
 *
 * **It draws none of its own colour (`UI-32a`).** The four variants are four blocks in
 * `components.css`, selected by `data-variant`, which is what makes hover and press expressible
 * at all -- an inline `background` beats every rule a stylesheet can write, so the resting fill
 * has to live beside the fill it changes to. The `focused` prop that faked the ring for the
 * specimen boards is gone with it: focus is `:focus-visible` now, once, for everything.
 */
export function Button({
  variant = 'primary',
  icon,
  href,
  download,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const shape = {
    'data-variant': variant,
    'data-hit-target': '',
    style: {
      height: 'var(--control-height)',
      padding: icon ? '0 15px 0 13px' : '0 15px',
      border: 'none',
      borderRadius: 'var(--radius-pill)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      // The height is fixed, so a wrapped label is drawn outside the pill. `style` overrides.
      flex: '0 0 auto',
      whiteSpace: 'nowrap',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--type-ui-size)',
      transition:
        'background var(--transition-state), color var(--transition-state), box-shadow var(--transition-state)',
      ...style,
    },
  };

  const content = (
    <>
      {icon !== undefined && <Icon name={icon} size={17} />}
      {children}
    </>
  );

  // No `rest` on the anchor: a button's handlers on a link are how a download becomes something
  // else.
  if (href !== undefined) {
    return (
      <a data-ds="button" href={href} download={download} {...shape}>
        {content}
      </a>
    );
  }

  return (
    <button data-ds="button" type="button" disabled={disabled} {...shape} {...rest}>
      {content}
    </button>
  );
}
