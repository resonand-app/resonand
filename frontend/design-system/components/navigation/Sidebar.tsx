import type { HTMLAttributes } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';

interface ItemProps {
  icon?: IconName | undefined;
  /** A library's colour, as a `var(--library-*)` reference. Replaces the glyph. */
  dot?: string | undefined;
  label: string;
  count?: number | null | undefined;
  active?: boolean;
  collapsed?: boolean;
  onClick?: (() => void) | undefined;
}

/** One destination. Unexported on purpose: the sidebar's rows are not a public component. */
function Item({ icon, dot, label, count, active = false, collapsed = false, onClick }: ItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        height: 32,
        width: '100%',
        border: 'none',
        background: active ? 'var(--accent-soft)' : 'transparent',
        color: active ? 'var(--accent-on-soft)' : 'var(--text-2)',
        borderRadius: 'var(--radius-control)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        padding: collapsed ? 0 : '0 11px',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        transition: 'background var(--transition-state), color var(--transition-state)',
      }}
    >
      {icon !== undefined && <Icon name={icon} size={17} />}
      {dot !== undefined && (
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 'var(--radius-circle)',
            flex: '0 0 auto',
            background: dot,
          }}
        />
      )}
      {!collapsed && (
        <>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'left',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontWeight: active ? 600 : 400,
            }}
          >
            {label}
          </span>
          {count !== null && count !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--type-numeric-size)',
                fontVariantNumeric: 'var(--type-numeric-variant)',
                color: 'var(--text-3)',
              }}
            >
              {count}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/** A group heading. Unexported for the same reason as `Item`. */
function GroupLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        padding: '16px 11px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--type-overline-size)',
        fontWeight: 'var(--type-overline-weight)',
        letterSpacing: 'var(--type-overline-tracking)',
        textTransform: 'uppercase',
        color: 'var(--text-3)',
      }}
    >
      {children}
    </div>
  );
}

export interface SidebarLibrary {
  id?: string;
  name: string;
  /** `var(--library-*)` reference. */
  colour: string;
  /** Recording count, mono and tabular. */
  count?: number;
}

export interface SidebarProps
  // `onSelect` is the DOM's on `HTMLAttributes` -- the text-selection event -- and this one hands
  // back a destination id. The `.jsx` had the same collision and nothing reported it; omitting it
  // is what lets the narrower signature stand rather than silently shadow a native handler.
  extends Omit<HTMLAttributes<HTMLElement>, 'onSelect'> {
  own?: SidebarLibrary[];
  shared?: SidebarLibrary[];
  trashCount?: number;
  /** Collapsed to 52px: icons only, libraries hidden behind the Libraries destination. */
  collapsed?: boolean;
  /** Current destination: "libraries", "trash", "settings", or a library id. */
  activeId?: string;
  onSelect?: (id: string) => void;
}

/**
 * The toggleable left bar: libraries you own, libraries shared with you, then Trash and Settings.
 *
 * **"Shared with you" disappears entirely rather than sitting empty** -- an empty group is a
 * standing reminder that nobody has shared anything with you, on every screen. Administration is
 * not a destination here; it lives inside Settings so that nobody wanders into it.
 */
export function Sidebar({
  own = [],
  shared = [],
  trashCount,
  collapsed = false,
  activeId = 'libraries',
  onSelect,
  style,
  ...rest
}: SidebarProps) {
  const pick = (id: string) => () => {
    onSelect?.(id);
  };
  const idOf = (library: SidebarLibrary) => library.id ?? library.name;

  return (
    <nav
      style={{
        width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)',
        flex: '0 0 auto',
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-panel)',
        display: 'flex',
        flexDirection: 'column',
        padding: collapsed ? '12px 9px' : '12px 10px',
        gap: collapsed ? 6 : 0,
        transition: 'width var(--transition-panel)',
        ...style,
      }}
      {...rest}
    >
      <Item
        icon="library"
        label="Libraries"
        active={activeId === 'libraries'}
        collapsed={collapsed}
        onClick={pick('libraries')}
      />
      {collapsed ? (
        <Item icon="search" label="Search" collapsed onClick={pick('search')} />
      ) : (
        <>
          <GroupLabel>Your libraries</GroupLabel>
          {own.map((library) => (
            <Item
              key={idOf(library)}
              dot={library.colour}
              label={library.name}
              count={library.count}
              active={activeId === idOf(library)}
              onClick={pick(idOf(library))}
            />
          ))}
          {shared.length > 0 && <GroupLabel>Shared with you</GroupLabel>}
          {shared.map((library) => (
            <Item
              key={idOf(library)}
              dot={library.colour}
              label={library.name}
              count={library.count}
              active={activeId === idOf(library)}
              onClick={pick(idOf(library))}
            />
          ))}
        </>
      )}
      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: collapsed ? 6 : 0,
        }}
      >
        <Item
          icon="trash-2"
          label="Trash"
          count={collapsed ? null : trashCount}
          collapsed={collapsed}
          active={activeId === 'trash'}
          onClick={pick('trash')}
        />
        <Item
          icon="sliders-horizontal"
          label="Settings"
          collapsed={collapsed}
          active={activeId === 'settings'}
          onClick={pick('settings')}
        />
      </div>
    </nav>
  );
}
