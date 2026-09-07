import type { HTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Selected filter or applied tag. */
  active?: boolean;
  children?: ReactNode;
}

/**
 * A tag or filter pill.
 *
 * Tags are user content and are shown verbatim -- accents, Catalan, whatever was typed. The chip
 * does not truncate, capitalise or otherwise improve them.
 */
export function Chip({ children, active, style, ...rest }: ChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 'var(--radius-chip)',
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent-on-soft)' : 'var(--text-2)',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </span>
  );
}
