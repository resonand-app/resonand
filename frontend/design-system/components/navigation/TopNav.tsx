import type {
  ChangeEvent,
  HTMLAttributes,
  KeyboardEvent,
  MouseEventHandler,
  ReactNode,
  Ref,
} from 'react';

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
  /**
   * `Enter` in the search field.
   *
   * The one key this component answers itself, because §3.2 gives it a meaning that belongs to
   * the field rather than to the page: the dropdown is the three-second case and `Enter` is how
   * somebody leaves it for the full results. The global handler cannot have it -- a binding that
   * fired while somebody was typing would be a binding that fired on every other field too.
   */
  onQuerySubmit?: () => void;
  onToggleSidebar?: () => void;
  onUpload?: () => void;
  onProfile?: () => void;
  /**
   * Where the lockup goes, which is the landing page (`UI-4e`).
   *
   * A link and not a button, for the reason a library card's title is one: going home is a
   * navigation. Absent leaves the lockup inert, which is what a specimen board wants.
   */
  homeHref?: string;
  /** The router's half of `homeHref`: cancel the browser's navigation and do it in the app. */
  onHome?: MouseEventHandler<HTMLAnchorElement>;
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
    /** Names the lockup when it is a link: the wordmark beside it is a picture of a word. */
    home?: string;
  };
  /**
   * The search input itself, for whoever owns the keyboard.
   *
   * `⌘K` and `/` focus this field from anywhere on the page (§1.8), and the handler that answers
   * them is global (`UI-4g`). Reaching the input through the DOM would be the alternative, and a
   * global handler that queries for a selector is one that breaks silently when the markup moves.
   */
  searchRef?: Ref<HTMLInputElement>;
  /** The avatar button, for an overlay that has to be anchored to it (`UI-4e`). */
  avatarRef?: Ref<HTMLButtonElement>;
  /** Rendered inside the search wrapper -- pass `SearchResults` here so it anchors to the field. */
  children?: ReactNode;
  /**
   * Rendered beside the avatar -- pass `ProfileMenu` here so it anchors to the button that opens
   * it (`UI-4e`). The search slot above is the wrong one for it: a menu about the account
   * hanging under the search field is a menu about the search.
   */
  accountMenu?: ReactNode;
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
  onQuerySubmit,
  onToggleSidebar,
  onUpload,
  onProfile,
  homeHref,
  onHome,
  labels,
  searchRef,
  avatarRef,
  children,
  accountMenu,
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
      {homeHref === undefined ? (
        <Logo size={21} />
      ) : (
        <a
          data-ds="nav-home"
          data-hit-target=""
          href={homeHref}
          onClick={onHome}
          aria-label={labels?.home ?? 'Sonarium home'}
        >
          <Logo size={21} />
        </a>
      )}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 540, position: 'relative' }}>
          <SearchField
            ref={searchRef}
            value={query}
            {...(labels?.search === undefined ? {} : { placeholder: labels.search })}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onQueryChange?.(event.target.value);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              onQuerySubmit?.();
            }}
          />
          {children}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <Button variant="primary" icon="upload" onClick={onUpload}>
          {labels?.upload ?? 'Upload audio'}
        </Button>
        <button
          ref={avatarRef}
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
        {accountMenu}
      </div>
    </header>
  );
}
