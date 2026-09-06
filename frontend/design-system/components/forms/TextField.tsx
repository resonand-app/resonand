import type { InputHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Error message. Presence switches the field to its error treatment. */
  error?: string;
  /** Renders the focus ring for specimen purposes; real focus comes from `:focus-visible`. */
  focused?: boolean;
}

/**
 * Single-line text input with an optional label and an error message beneath it.
 *
 * **It forwards `value` rather than translating it (`UI-1e`).** The `.jsx` this replaces took a
 * `value` prop and applied it as `defaultValue`, which is a controlled-looking API over an
 * uncontrolled field: the caller sets `value`, the field ignores every later change to it, and
 * nothing anywhere reports a problem. That is why `TopNav`'s `query` prop could not drive its
 * own search field. The input now receives whatever the caller passes -- `value` with `onChange`
 * for a controlled field, `defaultValue` for an uncontrolled one -- and React's own rules apply,
 * including its warning when the two are confused.
 *
 * The error message is rendered, not just coloured: an error a person can see the shape of but
 * not read is a field they cannot fix.
 */
export function TextField({ label, error, focused, style, ...rest }: TextFieldProps) {
  const ring =
    error !== undefined
      ? '0 0 0 1px #C4574A'
      : focused
        ? '0 0 0 2px var(--accent)'
        : 'none';

  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {label}
        </span>
      )}
      <span
        style={{
          height: 'var(--field-height)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          boxShadow: ring,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          transition: 'box-shadow var(--transition-state)',
        }}
      >
        <input
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: '13.5px',
            color: 'var(--text)',
          }}
          {...rest}
        />
        {error !== undefined && <Icon name="alert-circle" size={15} color="var(--state-failed)" />}
      </span>
      {error !== undefined && (
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--state-failed)',
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}
