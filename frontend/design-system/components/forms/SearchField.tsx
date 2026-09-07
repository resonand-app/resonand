import type { InputHTMLAttributes, Ref } from 'react';

import { Icon } from '../foundation/Icon';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Keyboard hint shown at the right edge. Pass null to hide it. */
  shortcut?: string | null | undefined;
  /**
   * The input, for whoever has to focus it.
   *
   * Named rather than taken as the component's own `ref`: this component renders a wrapper
   * around an input, and a caller writing `ref` means the thing that takes the caret. `UI-4g`
   * focuses this field from a global handler, which is the only caller that needs it.
   */
  ref?: Ref<HTMLInputElement> | undefined;
}

/**
 * The pill search field that sits in the centre of the top nav.
 *
 * It forwards `value` for the same reason `TextField` does (`UI-1e`): it took a `value` prop and
 * applied it as `defaultValue`, so the query in the URL could not drive the field showing it.
 * Search's whole design rests on the query living in the URL (§2.1), which makes this the one
 * field where that bug would have been noticed last and mattered most.
 *
 * **The magnifier goes amber on focus by inheritance (`UI-32a`).** It used to be a `focused` prop
 * the caller had to keep in step with reality; now `components.css` puts a colour on this wrapper
 * when it `:has(:focus-visible)`, and `Icon` defaults to `currentColor`, so the glyph follows and
 * nothing else does -- the input and the ⌘K hint both state their own.
 */
export function SearchField({
  placeholder = "Search everything you've recorded",
  shortcut = '⌘K',
  style,
  ref,
  ...rest
}: SearchFieldProps) {
  return (
    <div
      data-ds="search-field"
      data-hit-target=""
      style={{
        height: 'var(--field-height)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-pill)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        transition: 'box-shadow var(--transition-state)',
        ...style,
      }}
    >
      <Icon name="search" size={17} />
      <input
        ref={ref}
        // No `type="search"`: browsers give that one their own clear button and their own
        // Escape handling, and both are visual changes this task is not allowed to make.
        // `UI-4g` owns Escape, and the filter bar owns clearing.
        placeholder={placeholder}
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
      {shortcut !== null && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-overline-size)',
            color: 'var(--text-3)',
          }}
        >
          {shortcut}
        </span>
      )}
    </div>
  );
}
