import type { InputHTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';

export interface SearchFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Keyboard hint shown at the right edge. Pass null to hide it. */
  shortcut?: string | null | undefined;
  /** Renders the focus ring for specimen purposes; real focus comes from `:focus-visible`.
   *  Explicitly `| undefined`, like every prop a wrapper forwards: under
   *  `exactOptionalPropertyTypes`, `TopNav` cannot pass its own optional `searchFocused` to a
   *  merely optional prop without stripping the key first. */
  focused?: boolean | undefined;
}

/**
 * The pill search field that sits in the centre of the top nav.
 *
 * It forwards `value` for the same reason `TextField` does (`UI-1e`): it took a `value` prop and
 * applied it as `defaultValue`, so the query in the URL could not drive the field showing it.
 * Search's whole design rests on the query living in the URL (§2.1), which makes this the one
 * field where that bug would have been noticed last and mattered most.
 */
export function SearchField({
  placeholder = "Search everything you've recorded",
  shortcut = '⌘K',
  focused,
  style,
  ...rest
}: SearchFieldProps) {
  return (
    <div
      style={{
        height: 'var(--field-height)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-pill)',
        boxShadow: focused ? '0 0 0 2px var(--accent)' : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 14px',
        transition: 'box-shadow var(--transition-state)',
        ...style,
      }}
    >
      <Icon name="search" size={17} color={focused ? 'var(--accent)' : 'var(--text-3)'} />
      <input
        // No `type="search"`: browsers give that one their own clear button and their own
        // Escape handling, and both are visual changes this task is not allowed to make.
        // `UI-4g` owns Escape, and the filter bar owns clearing.
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
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
