import { useId, useState } from 'react';
import type { InputHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';
import { IconButton } from './IconButton';

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  /** Error message. Presence switches the field to its error treatment. */
  error?: string | undefined;
  /**
   * Accessible name for the reveal toggle, in the state where the password is hidden.
   *
   * Only meaningful on `type="password"`, and its presence is what turns the toggle on -- a
   * field passing neither this nor `hidePasswordLabel` renders exactly as before. Both are
   * required together because the one control needs a name for each of its two states.
   */
  showPasswordLabel?: string | undefined;
  /** Accessible name for the same toggle once the password is showing. */
  hidePasswordLabel?: string | undefined;
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
 *
 * **The reveal toggle owns its own state.** Nothing outside this field needs to know whether a
 * password is showing, so `revealed` is not lifted -- unlike `value`, which is (`UI-1e`) because
 * a caller genuinely drives it. Toggling it never touches `value`, so a password typed before
 * the reveal is pressed does not lose a character.
 *
 * **The label is `htmlFor`, not a wrapper, because the toggle sits inside the box.** A `<label>`
 * wrapping the whole field folds every descendant control's accessible name into the input's --
 * with the toggle inside that wrapper the field's name became "Password Show password", and
 * "Password Hide password" the moment it was pressed, which is a name that changes under a
 * screen reader for no reason a sighted person would recognise. Pointing the caption at the
 * input by `id` instead keeps the input's name as just the caption, whatever else is in the box.
 */
export function TextField({
  label,
  error,
  style,
  id,
  type,
  showPasswordLabel,
  hidePasswordLabel,
  ...rest
}: TextFieldProps) {
  const invalid = error !== undefined;
  const canReveal =
    type === 'password' && showPasswordLabel !== undefined && hidePasswordLabel !== undefined;
  const [revealed, setRevealed] = useState(false);
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label !== undefined && (
        <label
          htmlFor={inputId}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {label}
        </label>
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
          id={inputId}
          type={canReveal ? (revealed ? 'text' : 'password') : type}
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
        {canReveal && (
          <IconButton
            icon={revealed ? 'eye-off' : 'eye'}
            variant="filled"
            size={28}
            label={revealed ? hidePasswordLabel : showPasswordLabel}
            onClick={() => {
              setRevealed((was) => !was);
            }}
          />
        )}
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
    </div>
  );
}
