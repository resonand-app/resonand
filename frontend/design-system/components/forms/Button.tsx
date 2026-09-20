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
  /**
   * Whether the work this button started is still running.
   *
   * It turns the glyph and marks the control `aria-busy`, so a press that reaches a third party
   * says so while it waits. It does not disable anything: whether pressing again is safe is a
   * question about the endpoint, and the caller answers it with `disabled`.
   */
  busy?: boolean;
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
 * **`busy` is the one exception to the system's refusal to animate.** It borrows `StateCard`'s
 * turning glyph and borrows its justification with it: a skeleton animates the absence of an
 * answer, for ever, while this turns only while a request somebody pressed is genuinely in flight
 * and stops when it lands. It claims no fraction, because a bar would still be a lie.
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
  busy,
  href,
  download,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  // The spinner stands where the icon would, rather than beside it: two glyphs on one pill is a
  // wider button the moment it is pressed.
  const glyph = busy === true ? 'loader' : icon;
  const shape = {
    'data-variant': variant,
    'data-hit-target': '',
    'data-busy': busy === true ? 'true' : undefined,
    style: {
      height: 'var(--control-height)',
      padding: glyph ? '0 15px 0 13px' : '0 15px',
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
      {glyph !== undefined && <Icon name={glyph} size={17} />}
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
    <button
      data-ds="button"
      type="button"
      disabled={disabled}
      aria-busy={busy === true ? true : undefined}
      {...shape}
      {...rest}
    >
      {content}
    </button>
  );
}
