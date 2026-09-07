import type { HTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

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
  /** Current theme label: "Dark", "Light" or "System". */
  theme?: string;
  onTheme?: () => void;
  onSettings?: () => void;
  onSignOut?: () => void;
}

/**
 * The dialog behind the account button: identity, theme, Settings, Sign out. Nothing more.
 *
 * **The sample-data defaults are gone (`UI-1h`).** It used to arrive as "Martí Colom", initials MC,
 * "marti@sonarium.app", on a Dark theme -- so a forgotten prop rendered a complete, plausible
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
  onTheme,
  onSettings,
  onSignOut,
  style,
  ...rest
}: ProfileMenuProps) {
  return (
    <div
      role="menu"
      data-ds="profile-menu"
      style={{
        width: 236,
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
      <div style={{ height: 1, background: 'var(--hairline)', margin: '2px 0 4px' }} />
      <Row icon="moon" label="Theme" value={theme} onClick={onTheme} />
      <Row icon="sliders-horizontal" label="Settings" onClick={onSettings} />
      <Row icon="log-out" label="Sign out" onClick={onSignOut} />
    </div>
  );
}
