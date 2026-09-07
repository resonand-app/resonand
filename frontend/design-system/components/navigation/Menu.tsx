import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import type { IconName } from '../foundation/Icon';
import { IconButton } from '../forms/IconButton';
import { useAnchoredOverlay } from '../overlay/useAnchoredOverlay';

export interface MenuItem {
  /** Unique within one menu. Also what `onSelect` is told. */
  id: string;
  label: string;
  icon?: IconName;
  /** Draws the item in `--state-failed`. Deletion, and nothing else. */
  destructive?: boolean;
  /** A rule above this item. Groups the destructive action away from the ordinary ones. */
  separated?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  onSelect?: (id: string) => void;
  /** Names the menu and its trigger. "Recording options", "Library actions". */
  label: string;
  /**
   * The control that opens it, wired by the caller. Defaults to the overflow button that the
   * cards and rows use.
   *
   * It is handed `onToggle` rather than being wrapped in something clickable: a wrapper around a
   * button is a second hit target with no accessible name, and the thing that opens a menu has to
   * be the thing a screen reader announces as opening it.
   */
  trigger?: (props: { open: boolean; onToggle: () => void }) => ReactNode;
  /** Menu width in px. */
  width?: number;
  /** Drive it from outside. Leave it alone and the menu opens and closes itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * The overflow menu (`UI-34c`).
 *
 * Card and row overflow, library actions, job actions. `ProfileMenu` stays what it is -- a
 * specific dialog with an identity block at the top -- and is deliberately not refactored onto
 * this: it is one thing that happens to look like a menu, and merging them would make both worse.
 *
 * **There is no `disabled` on a `MenuItem`, and that is the design.** An action the user cannot
 * take is absent from the menu. A disabled row invites somebody to work out why, offers nothing
 * to click to find out, and in a product whose ACL returns 404 rather than 403 it would also be a
 * way of confirming that something exists. So the caller filters the list, and the menu draws
 * what is left. `Select` is the opposite case and does have `disabled`: an option nobody may
 * choose still has to be readable, because it explains the shape of the list it is in.
 *
 * Destructive items take `--state-failed` and sit under a rule. There is exactly one per menu in
 * this product, it is always last, and it always says what it destroys before it does it.
 */
export function Menu({
  items,
  onSelect,
  label,
  trigger,
  width = 214,
  open: openProp,
  onOpenChange,
}: MenuProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const { anchorRef, surfaceRef, surfaceStyle, id } = useAnchoredOverlay<HTMLDivElement>({
    open,
    onClose: close,
    placement: 'bottom',
    align: 'end',
  });

  /* Roving focus, unlike `Select`. A menu item is an action and therefore a real button, so the
     thing with focus is the thing `Enter` would fire -- there is no value to name, and nothing
     for `aria-activedescendant` to add. */
  const focusItem = (index: number) => {
    const count = items.length;
    if (count === 0) return;
    itemsRef.current[((index % count) + count) % count]?.focus();
  };

  const indexOfActive = () =>
    itemsRef.current.findIndex((element) => element === document.activeElement);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(indexOfActive() + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(indexOfActive() - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div ref={anchorRef} style={{ display: 'inline-flex' }}>
        {trigger === undefined ? (
          <IconButton
            icon="more-vertical"
            variant="ghost"
            label={label}
            active={open}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? id : undefined}
            onClick={() => {
              setOpen(!open);
            }}
          />
        ) : (
          trigger({
            open,
            onToggle: () => {
              setOpen(!open);
            },
          })
        )}
      </div>
      {open && (
        <div
          ref={surfaceRef}
          id={id}
          role="menu"
          // Programmatically focusable and not a tab stop. The overlay moves focus to the first
          // item, and this is where focus lands if a menu ever has none.
          tabIndex={-1}
          aria-label={label}
          data-ds="menu"
          onKeyDown={onKeyDown}
          style={{
            ...surfaceStyle,
            zIndex: 'var(--z-menu)',
            width,
            padding: 6,
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--elevation-overlay)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {items.map((item, index) => (
            <div key={item.id} style={{ display: 'contents' }}>
              {item.separated === true && (
                <span
                  data-ds="menu-rule"
                  style={{ height: 'var(--border-hairline)', margin: '5px 8px' }}
                />
              )}
              <button
                type="button"
                role="menuitem"
                ref={(element) => {
                  itemsRef.current[index] = element;
                }}
                data-ds="menu-row"
                data-destructive={item.destructive === true ? 'true' : undefined}
                onClick={() => {
                  onSelect?.(item.id);
                  close();
                }}
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
                  textAlign: 'left',
                  transition: 'background var(--transition-state), color var(--transition-state)',
                }}
              >
                {item.icon !== undefined && <Icon name={item.icon} size={17} />}
                <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
