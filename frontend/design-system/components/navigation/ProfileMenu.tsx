import type { HTMLAttributes, KeyboardEvent, Ref } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

import { stepMenuFocus } from './menu-focus';

interface RowProps {
  icon: IconName;
  label: string;
  value?: string | undefined;
  onClick?: (() => void) | undefined;
}

function Row({ icon, label, value, onClick }: RowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      data-ds="menu-row"
      style={{
        height: 34,
        width: '100%',
        border: 'none',
        borderRadius: 'var(--radius-control)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 10px',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        transition: 'background var(--transition-state)',
      }}
    >
      <Icon name={icon} size={17} color="var(--text-3)" />
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      {value !== undefined && value !== '' && (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-numeric-size)',
            color: 'var(--text-3)',
          }}
        >
          {value}
        </span>
      )}
    </button>
  );
}

export interface ProfileMenuProps extends HTMLAttributes<HTMLDivElement> {
  name?: string;
  email?: string;
  initials?: string;
  /** Current theme label: "Dark" or "Light". */
  theme?: string;
  /**
   * The glyph on the theme row: the theme somebody is in, not the one pressing it would bring.
   *
   * A moon in the dark and a sun in the light, which is the reading everybody already has for
   * those two shapes -- a row that showed the destination instead would be a row whose icon and
   * whose value disagreed.
   */
  themeIcon?: IconName;
  onTheme?: () => void;
  onSettings?: () => void;
  /**
   * The copy, for an application that has its own (`UI-22a`).
   *
   * English defaults so a specimen renders labelled rows; replaceable, because three words baked
   * in here are three words the interface can never translate.
   */
  labels?: {
    theme?: string;
    settings?: string;
    signOut?: string;
  };
  /** The surface itself, for the overlay hook that places it (`UI-34a`, `UI-4e`). */
  ref?: Ref<HTMLDivElement> | undefined;
  onSignOut?: () => void;
}

/**
 * The dialog behind the account button: identity, theme, Settings, Sign out. Nothing more.
 *
 * **The sample-data defaults are gone (`UI-1h`).** It used to arrive as "Ángela Ruiz", initials MC,
 * "marti@resonand.app", on a Dark theme -- so a forgotten prop rendered a complete, plausible
 * account belonging to nobody. Empty is now visibly empty.
 *
 * There are no avatar images anywhere in the product: no storage exists for them and fetching one
 * externally would break the promise that nothing leaves the instance. Identity is initials.
 */
export function ProfileMenu({
  name = '',
  email = '',
  initials = '',
  theme,
  themeIcon = 'moon',
  onTheme,
  onSettings,
  labels,
  ref,
  onSignOut,
  style,
  onKeyDown,
  ...rest
}: ProfileMenuProps) {
  // A menu is walked with the arrow keys, as `Menu` is: the role is a promise about the keyboard
  // as much as a name for the screen reader (`INF-24a`).
  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    if (stepMenuFocus(event.key, rows)) event.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="menu"
      // Programmatically focusable and not a tab stop, as `Menu` is: the rows take the focus.
      tabIndex={-1}
      onKeyDown={walk}
      data-ds="profile-menu"
      style={{
        width: 236,
        // Without a layer it stacks by DOM order, which puts it under the positioned `<main>`
        // the nav is drawn before -- painted behind the view, with no row clickable.
        zIndex: 'var(--z-menu)',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-overlay)',
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px 10px' }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-circle)',
            background: 'var(--accent-soft)',
            color: 'var(--accent-on-soft)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontWeight: 'var(--weight-medium)',
            fontSize: 'var(--type-ui-size-sm)',
            flex: '0 0 auto',
          }}
        >
          {initials}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text)',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {email}
          </span>
        </div>
      </div>
      <div
        role="separator"
        style={{ height: 1, background: 'var(--hairline)', margin: '2px 0 4px' }}
      />
      <Row icon={themeIcon} label={labels?.theme ?? 'Theme'} value={theme} onClick={onTheme} />
      <Row
        icon="sliders-horizontal"
        label={labels?.settings ?? 'Settings'}
        onClick={onSettings}
      />
      <Row icon="log-out" label={labels?.signOut ?? 'Sign out'} onClick={onSignOut} />
    </div>
  );
}
