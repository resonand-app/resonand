import type { ReactNode } from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The setting, in the words it is described by. */
  label: ReactNode;
  /** What turning it on will do, especially where that is somewhere the audio goes. */
  description?: ReactNode;
  disabled?: boolean;
  /** Names it when `label` is not a string -- an `EgressNotice` beside it, say. */
  ariaLabel?: string;
}

/**
 * A setting that takes effect at once (`UI-34e`).
 *
 * Administration's toggles, and "transcribe when the upload finishes". **Never for something that
 * needs a Save** -- which is why Account's fields are `TextField`s and not switches. A control
 * that looks like it applied and did not is worse than a form: the person has already moved on.
 *
 * That rule is what makes the description slot matter. The switch that sends audio to an external
 * transcription provider is a switch whose consequence has to be readable *before* it is flipped,
 * because there is no confirm step between the two -- §3.4 and `UI-34n`'s `EgressNotice` are what
 * goes there.
 *
 * A `role="switch"` button and not a checkbox: they are announced differently and they mean
 * different things. A checkbox is part of a set you will submit; a switch is a thing that is on.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  ariaLabel,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      data-ds="switch"
      data-hit-target=""
      onClick={() => {
        onChange(!checked);
      }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        /* The row is the target, and it is 44 tall whatever the text does. A 34x20 track on its
           own is under the floor in both axes, and growing it with a pseudo-element would put a
           44px target inside a 20px switch with the label beside it doing nothing. */
        minHeight: 'var(--hit-target)',
        width: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span
        data-ds="switch-track"
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 34,
          height: 20,
          borderRadius: 'var(--radius-pill)',
          position: 'relative',
          marginTop: 2,
          transition: 'background var(--transition-state)',
        }}
      >
        <span
          data-ds="switch-knob"
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 16 : 2,
            width: 16,
            height: 16,
            borderRadius: 'var(--radius-circle)',
            transition: 'left var(--transition-state), background var(--transition-state)',
          }}
        />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-medium)',
            color: 'var(--text)',
          }}
        >
          {label}
        </span>
        {description !== undefined && (
          <span
            style={{
              fontSize: 'var(--type-ui-size-sm)',
              lineHeight: 'var(--type-ui-leading)',
              color: 'var(--text-3)',
            }}
          >
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
