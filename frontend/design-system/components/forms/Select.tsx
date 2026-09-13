import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';

import { Icon } from '../foundation/Icon';
import { useAnchoredOverlay } from '../overlay/use-anchored-overlay';

export interface SelectOption<Value extends string = string> {
  value: Value;
  label: string;
  /** A second line, for an option whose meaning is not obvious from its name. */
  description?: string;
  disabled?: boolean;
}

export interface SelectProps<Value extends string = string> {
  /** The chosen value. `undefined` shows the placeholder. */
  value?: Value | undefined;
  onChange?: (value: Value) => void;
  options: SelectOption<Value>[];
  /** Sits above the control, 12px and quiet. */
  label?: string;
  /** Shown when nothing is chosen. It names the field rather than saying "Select…". */
  placeholder?: string;
  disabled?: boolean;
  /** Minimum width of the trigger in px. The menu matches whichever is wider. */
  width?: number;
  /** Drive the menu from outside. Leave it alone and the control opens and closes itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Names the control for a screen reader when there is no visible `label`. */
  ariaLabel?: string;
}

/**
 * Picks one value from a list (`UI-34b`).
 *
 * The filter bar, sort, the level selector's underlying control, the category picker and playback
 * speed. **Not for a set of two or three short options** -- those are `Chip`s, which show every
 * choice at once and cost one click instead of two. The rule of thumb the specification uses: if
 * the options fit on the row, they are chips.
 *
 * It is not a `<select>`. The native control cannot draw an option with a description under it,
 * which `UI-34k`'s level selector needs, and its menu is painted by the operating system in
 * colours this system does not choose -- on a dark interface that is a white rectangle. What is
 * kept is the behaviour: `ArrowDown` opens, the arrows move, `Enter` chooses, `Esc` closes, and
 * `Home` and `End` go to the ends.
 *
 * The keyboard model is `aria-activedescendant` rather than a roving tab stop: focus stays on the
 * listbox and the active option is named. A tab stop per option would make `Tab` walk a list of
 * thirty sort orders, and the focus trap would then have thirty places to be.
 */
export function Select<Value extends string = string>({
  value,
  onChange,
  options,
  label,
  placeholder = 'Choose',
  disabled = false,
  width = 168,
  open: openProp,
  onOpenChange,
  ariaLabel,
}: SelectProps<Value>) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
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

  const { anchorRef, surfaceRef, surfaceStyle, id } = useAnchoredOverlay<HTMLButtonElement>({
    open,
    onClose: close,
    placement: 'bottom',
    align: 'start',
  });

  const selectedIndex = options.findIndex((option) => option.value === value);
  const [active, setActive] = useState(Math.max(0, selectedIndex));

  /* Opening puts the highlight on what is already chosen rather than on the top of the list --
     somebody opening the sort menu to see what it is currently sorted by should not have to read
     -- and it is set here, at the gesture, rather than in an effect watching `open`. An effect
     would set state during a render the moment the menu appeared, which is a second render for
     something already known at the click. */
  const openMenu = () => {
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  };

  const chosen = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const step = (from: number, direction: 1 | -1): number => {
    // Past anything unavailable, and stopping at the ends rather than wrapping: a list that
    // wraps makes "am I at the bottom?" a question you have to keep answering.
    for (let i = from + direction; i >= 0 && i < options.length; i += direction) {
      if (options[i]?.disabled !== true) return i;
    }
    return from;
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined || option.disabled === true) return;
    onChange?.(option.value);
    close();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
      event.preventDefault();
      openMenu();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive((current) => step(current, 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive((current) => step(current, -1));
        break;
      case 'Home':
        event.preventDefault();
        setActive(step(-1, 1));
        break;
      case 'End':
        event.preventDefault();
        setActive(step(options.length, -1));
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(active);
        break;
      default:
        break;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label !== undefined && (
        <span
          id={`${id}-label`}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {label}
        </span>
      )}
      <button
        type="button"
        ref={anchorRef}
        disabled={disabled}
        data-ds="select-trigger"
        data-hit-target=""
        // A button that opens a list of values is a combobox, and saying so is what makes a
        // screen reader announce the current value and the expanded state rather than "button".
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-labelledby={label === undefined ? undefined : `${id}-label`}
        aria-label={label === undefined ? ariaLabel : undefined}
        onClick={() => {
          if (open) close();
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
        style={{
          height: 'var(--control-height)',
          minWidth: width,
          padding: '0 10px 0 12px',
          border: 'none',
          borderRadius: 'var(--radius-control)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          transition: 'background var(--transition-state), color var(--transition-state)',
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chosen?.label ?? placeholder}
        </span>
        <Icon name="chevron-down" size={15} />
      </button>
      {open && (
        <div
          ref={surfaceRef}
          id={id}
          role="listbox"
          tabIndex={0}
          aria-activedescendant={`${id}-${String(active)}`}
          aria-label={label ?? ariaLabel}
          data-ds="select-menu"
          onKeyDown={onListKeyDown}
          style={{
            ...surfaceStyle,
            zIndex: 'var(--z-menu)',
            minWidth: width,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 6,
            borderRadius: 'var(--radius-control)',
            boxShadow: 'var(--elevation-overlay)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {options.map((option, index) => (
            /* The two rules below are the `aria-activedescendant` pattern, which jsx-a11y does
               not model. Focus stays on the listbox and the active option is named by id, so an
               option is not a tab stop and its keys are the list's -- a tab stop per option
               would make `Tab` walk thirty sort orders and give the focus trap thirty places to
               be. `tabIndex={-1}` keeps it programmatically focusable without being one. */
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events -- see above
            <div
              key={option.value}
              tabIndex={-1}
              id={`${id}-${String(index)}`}
              role="option"
              aria-selected={option.value === value}
              aria-disabled={option.disabled}
              data-ds="select-option"
              data-selected={option.value === value ? 'true' : undefined}
              data-active={index === active ? 'true' : undefined}
              onClick={() => {
                choose(index);
              }}
              onPointerMove={() => {
                setActive(index);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                minHeight: 32,
                padding: option.description === undefined ? '0 10px' : '7px 10px',
                borderRadius: 'var(--radius-control)',
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size)',
                opacity: option.disabled === true ? 'var(--opacity-disabled)' : undefined,
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span>{option.label}</span>
                {option.description !== undefined && (
                  <span
                    style={{
                      fontSize: 'var(--type-ui-size-sm)',
                      lineHeight: 1.5,
                      color: 'var(--text-3)',
                    }}
                  >
                    {option.description}
                  </span>
                )}
              </span>
              {option.value === value && <Icon name="check" size={15} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
