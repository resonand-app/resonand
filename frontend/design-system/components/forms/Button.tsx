import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

const FILL: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-on)',
    /* The amber glow is hard-coded, so it is identical in light mode where it should not be.
       Replacing it is a decision about what the token ought to be rather than a rename, and
       `UI-33a` is the task that takes it. */
    // eslint-disable-next-line no-restricted-syntax -- UI-33a
    boxShadow: '0 2px 8px rgba(232,180,92,.2)',
    fontWeight: 600,
  },
  secondary: { background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 500 },
  ghost: { background: 'transparent', color: 'var(--text-2)', fontWeight: 500 },
  danger: { background: 'var(--state-failed-bg)', color: 'var(--state-failed-fg)', fontWeight: 500 },
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary for the one main action per view; ghost for Cancel; danger for destructive confirms. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Glyph rendered before the label. */
  icon?: IconName;
  /** Renders the focus ring for specimen purposes; real focus comes from `:focus-visible`. */
  focused?: boolean;
  children?: ReactNode;
}

/**
 * The system's text button. Pill-shaped at every size.
 *
 * One primary per view: it is the same amber as a playing waveform and an active nav item, and
 * two of them on a screen means neither is the main action.
 */
export function Button({
  variant = 'primary',
  icon,
  children,
  disabled,
  focused,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
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
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.38 : 1,
        transition: 'background var(--transition-state), color var(--transition-state)',
        outline: focused ? 'var(--focus-ring-width) solid var(--accent)' : 'none',
        outlineOffset: 'var(--focus-ring-offset)',
        ...FILL[variant],
        ...style,
      }}
      {...rest}
    >
      {icon !== undefined && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
