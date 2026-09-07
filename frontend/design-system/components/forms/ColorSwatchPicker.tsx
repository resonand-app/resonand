import type { HTMLAttributes } from 'react';

import { LIBRARY_COLORS } from '../../library-colors';
import type { LibraryColorName } from '../../library-colors';

export interface ColorSwatchPickerProps
  // `onChange` is the DOM's on `HTMLAttributes`, and this one hands back a colour name rather
  // than an event. Omitting it is what lets the narrower signature stand.
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Selected colour name. */
  value?: LibraryColorName;
  onChange?: (name: LibraryColorName) => void;
  /** Swatch diameter in px. */
  size?: number;
  /** Inline label. Pass null to omit it. */
  label?: string | null;
}

/**
 * The seven library colours as a single row of swatches.
 *
 * The selected swatch is ringed rather than ticked, because a tick on a colour is a glyph whose
 * contrast depends on the colour underneath it -- and two of the seven would fail. The ring is
 * drawn by `components.css` from `data-selected`; the colour itself stays inline, because it is
 * the one thing here that is data rather than state (`UI-32a`).
 */
export function ColorSwatchPicker({
  value = 'clay',
  onChange,
  size = 22,
  label = 'Colour',
  style,
  ...rest
}: ColorSwatchPickerProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...style }} {...rest}>
      {label !== null && (
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
      <div style={{ display: 'flex', gap: 6 }}>
        {LIBRARY_COLORS.map((colour) => (
          <button
            key={colour.name}
            type="button"
            aria-label={colour.name}
            aria-pressed={value === colour.name}
            data-ds="swatch"
            data-selected={value === colour.name ? 'true' : undefined}
            data-hit-target=""
            onClick={() => onChange?.(colour.name)}
            style={{
              width: size,
              height: size,
              border: 'none',
              borderRadius: 'var(--radius-circle)',
              background: colour.value,
              transition: 'box-shadow var(--transition-state)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
