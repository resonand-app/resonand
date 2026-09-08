import type { HTMLAttributes, ReactNode } from 'react';

export interface ChipProps extends HTMLAttributes<HTMLElement> {
  /** Selected filter or applied tag. */
  active?: boolean;
  /**
   * Which element to draw (`UI-8c`).
   *
   * A tag on a card is a `span`, because it is a label and nothing happens when it is pressed. A
   * filter toggle is a `button`, because something does -- and it has to be a real one to be in
   * the tab order and to be announced as pressed.
   *
   * `components.css` was already written for both cases and the component could only produce one
   * of them, so the hover it declares for an interactive chip was unreachable.
   */
  as?: 'span' | 'button';
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
export function Chip({ children, active, as = 'span', style, ...rest }: ChipProps) {
  const Element = as;
  return (
    <Element
      // A 24px pill is under the 44px floor, so the target is grown with the stylesheet's
      // pseudo-element rather than by growing the pill -- which would make a row of filters
      // twice as tall as the bar they sit in (`UI-32b`).
      {...(as === 'button' ? { type: 'button' as const, 'data-hit-target': '' } : {})}
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
        gap: 5,
        border: 'none',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </Element>
  );
}
