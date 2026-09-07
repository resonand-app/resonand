import type { ChangeEvent, HTMLAttributes, ReactNode } from 'react';

import { Logo } from '../foundation/Logo';
import { Button } from '../forms/Button';
import { IconButton } from '../forms/IconButton';
import { SearchField } from '../forms/SearchField';

export interface TopNavProps extends HTMLAttributes<HTMLElement> {
  /** Account initials shown in the avatar button. */
  initials?: string;
  /** Current search text. */
  query?: string;
  /** Called as the search field is typed into. */
  onQueryChange?: (query: string) => void;
  onToggleSidebar?: () => void;
  onUpload?: () => void;
  onProfile?: () => void;
  /**
   * The copy, for an application that has its own (`UI-22a`).
   *
   * The defaults are English, because a component with no label at all is a component that draws
   * an empty button in a specimen. But every literal a person reads has to be replaceable from
   * outside the system: the interface externalises all of its copy, and a string baked in here
   * would be one that can never be translated.
   */
  labels?: {
    search?: string;
    sidebar?: string;
    upload?: string;
    account?: string;
  };
  /** Rendered inside the search wrapper -- pass `SearchResults` here so it anchors to the field. */
  children?: ReactNode;
}

/**
 * The application's one top bar: sidebar toggle and logo left, search centre, upload and account
 * right.
 *
 * **`onQueryChange` is new, and `UI-1e` is why (`UI-1h`).** `TopNav` passed `query` to a field that
 * turned it into a `defaultValue`, so the prop was inert and nothing said so. Now that the field
 * forwards `value`, a `value` with no `onChange` is a field React refuses to let anybody type in --
 * so the handler is passed always and forwards to this callback when there is one. That is what
 * `UI-4e` needs to put the query in the URL, which is where §2.1 says it lives.
 *
 * There is no avatar image, here or anywhere: no storage exists for one and fetching it externally
 * would break the promise that nothing leaves the instance. Identity is initials.
 *
 * **`searchFocused` is gone (`UI-32b`).** It asked a caller to keep a boolean in step with where
 * the browser thinks focus is, and the browser is the only thing that knows: the field draws its
 * own ring from `:focus-visible` now, like every other control in the system.
 */
export function TopNav({
  initials = '',
  query,
  onQueryChange,
  onToggleSidebar,
  onUpload,
  onProfile,
  labels,
  children,
  style,
  ...rest
}: TopNavProps) {
  return (
    <header
      data-ds="top-nav"
      style={{
        height: 'var(--nav-height)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 14px',
        position: 'relative',
        ...style,
      }}
      {...rest}
    >
      <IconButton
        icon="panel-left"
        label={labels?.sidebar ?? 'Toggle sidebar'}
        onClick={onToggleSidebar}
        style={{ borderRadius: 'var(--radius-control)' }}
      />
      <Logo size={21} />
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 540, position: 'relative' }}>
          <SearchField
            value={query}
            {...(labels?.search === undefined ? {} : { placeholder: labels.search })}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onQueryChange?.(event.target.value);
            }}
          />
          {children}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Button variant="primary" icon="upload" onClick={onUpload}>
          {labels?.upload ?? 'Upload audio'}
        </Button>
        <button
          type="button"
          onClick={onProfile}
          aria-label={labels?.account ?? 'Account'}
          data-ds="avatar-button"
          data-hit-target=""
          style={{
            width: 32,
            height: 32,
            border: 'none',
            borderRadius: 'var(--radius-circle)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-numeric-size)',
          }}
        >
          {initials}
        </button>
      </div>
    </header>
  );
}
