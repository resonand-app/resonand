import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary for the one main action per view; ghost for Cancel; danger for destructive confirms. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Glyph rendered before the label. */
  icon?: IconName;
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
export function Button({ variant = 'primary', icon, children, disabled, style, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      data-ds="button"
      data-variant={variant}
      data-hit-target=""
      disabled={disabled}
      style={{
        height: 'var(--control-height)',
        padding: icon ? '0 15px 0 13px' : '0 15px',
        border: 'none',
        borderRadius: 'var(--radius-pill)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        transition:
          'background var(--transition-state), color var(--transition-state), box-shadow var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      {icon !== undefined && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
