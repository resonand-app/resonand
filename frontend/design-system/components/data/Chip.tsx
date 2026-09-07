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
 *
 * It is inert as a tag and interactive as a filter, which is one component in two places -- so
 * `components.css` writes the hover against the interactive case only, and a tag sitting on a
 * card does not light up under a pointer that is on its way somewhere else (`UI-32a`).
 */
export function Chip({ children, active, style, ...rest }: ChipProps) {
  return (
    <span
      data-ds="chip"
      data-active={active === true ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 'var(--radius-chip)',
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
