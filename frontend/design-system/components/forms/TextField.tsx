import type { InputHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

/* eslint-disable-next-line no-restricted-syntax -- UI-33a. This matches no token in the system.
   It is nearest to `--state-failed`, and choosing that is a decision about what the error
   treatment should be rather than a rename, so it is UI-33a's to make. */
const ERROR_RING = '0 0 0 1px #C4574A';
const FOCUS_RING = '0 0 0 2px var(--accent)';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  /** Error message. Presence switches the field to its error treatment. */
  error?: string | undefined;
  /** Renders the focus ring for specimen purposes; real focus comes from `:focus-visible`. */
  focused?: boolean | undefined;
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
  const ring = error !== undefined ? ERROR_RING : focused ? FOCUS_RING : 'none';

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
