import type { InputHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  /** Error message. Presence switches the field to its error treatment. */
  error?: string | undefined;
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
 *
 * **The `outline: none` is gone (`UI-32b`).** It sat on the input and gave nothing back, which is
 * a field that is invisible when focused -- on the one control a keyboard user has no choice but
 * to land on. The ring is drawn around the box by `components.css`, and the error ring is drawn
 * there too, so a field that is both wrong and focused shows both.
 */
export function TextField({ label, error, style, ...rest }: TextFieldProps) {
  const invalid = error !== undefined;

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
        data-ds="field-box"
        data-invalid={invalid ? 'true' : undefined}
        data-hit-target=""
        style={{
          height: 'var(--field-height)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-control)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          transition: 'box-shadow var(--transition-state)',
        }}
      >
        <input
          aria-invalid={invalid ? true : undefined}
          style={{
            flex: 1,
            minWidth: 0,
            border: 'none',
            background: 'transparent',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            color: 'var(--text)',
          }}
          {...rest}
        />
        {invalid && <Icon name="alert-circle" size={15} color="var(--state-failed)" />}
      </span>
      {invalid && (
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
