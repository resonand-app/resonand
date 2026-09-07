import { Icon } from '../foundation/Icon';

/**
 * Checked, not checked, or some of them.
 *
 * `mixed` is a header's state and never an item's: it says "some of the rows below are selected",
 * which is a fact about a set. Clicking a mixed header selects everything, because the alternative
 * -- clearing -- throws away work somebody has already done.
 */
export type CheckedState = boolean | 'mixed';

export interface CheckboxProps {
  checked: CheckedState;
  onChange: (checked: boolean) => void;
  /** Required. The control has no visible text of its own in either place it is used. */
  label: string;
  /**
   * `card` is 18px in the corner opposite the play control; `row` is 16px in its own column in a
   * dense list. The two sizes are the two places selection happens (§4).
   */
  size?: 'card' | 'row';
  disabled?: boolean;
}

/**
 * Selection that does not fight the play button (`UI-34f`).
 *
 * On a card it sits in the corner **opposite** the play control, because selecting forty
 * recordings and playing one are things people do in the same minute and a mis-click either way
 * is annoying in a different direction. In a dense row it has a column of its own.
 *
 * **The radius is `--radius-chip` and the canvas drew 6px.** Neither 6 nor the row size's 5 is on
 * the four-step radius scale, and `UI-33a` has just finished deleting the last of the one-off
 * sizes that were on the type scale. At 18px the difference between 6 and 8 is a fraction of a
 * pixel of visual weight; a fifth radius is a decision the system would carry for ever.
 *
 * It is a real `<button role="checkbox">` rather than an `<input>`, for the reason every control
 * in this system is: an input's box is drawn by the operating system, and `appearance: none` plus
 * a hand-drawn tick is the same code with a native element underneath it that no longer means
 * anything.
 */
export function Checkbox({ checked, onChange, label, size = 'card', disabled = false }: CheckboxProps) {
  const box = size === 'card' ? 18 : 16;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked === 'mixed' ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      data-ds="checkbox"
      data-hit-target=""
      data-checked={checked === false ? undefined : checked === 'mixed' ? 'mixed' : 'true'}
      onClick={() => {
        /* A mixed header selects the rest rather than clearing: clearing throws away a selection
           somebody has already spent clicks building. */
        onChange(checked !== true);
      }}
      style={{
        width: box,
        height: box,
        minWidth: box,
        padding: 0,
        border: 'none',
        borderRadius: 'var(--radius-chip)',
        display: 'grid',
        placeItems: 'center',
        transition: 'background var(--transition-state), box-shadow var(--transition-state)',
      }}
    >
      {checked === true && <Icon name="check" size={13} strokeWidth={2.2} />}
      {checked === 'mixed' && <Icon name="minus" size={13} strokeWidth={2.2} />}
    </button>
  );
}
