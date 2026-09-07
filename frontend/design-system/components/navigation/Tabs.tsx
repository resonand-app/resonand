import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

export interface Tab<Value extends string = string> {
  value: Value;
  label: string;
}

export interface TabsProps<Value extends string = string> {
  tabs: Tab<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  /** Names the set for a screen reader: "Settings sections", "Recording metadata". */
  label: string;
  /** The id of the panel each tab controls, if the panels are rendered by the caller. */
  panelId?: string;
}

/**
 * Sections inside one view (`UI-34d`).
 *
 * Settings' four sections, and the phone's metadata sheet. A hairline track with a 2px accent bar
 * under the current tab -- **and no pill track**, because a segmented control reads as a filter in
 * this interface: the filter bar above a library grid is made of pills, and two controls that look
 * the same and do different things is the one confusion a design system exists to prevent.
 *
 * The keyboard is the ARIA tabs pattern and not a row of buttons: `Tab` reaches the tab strip
 * once, and the arrows move within it. That is what stops Settings' four sections from costing
 * four tab stops on the way to the thing somebody came to change.
 *
 * It renders the strip and not the panels. Which panel is on screen is the caller's state, and a
 * component that owned both would have to be told how to render every section of Settings.
 */
export function Tabs<Value extends string = string>({
  tabs,
  value,
  onChange,
  label,
  panelId,
}: TabsProps<Value>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, direction: 1 | -1) => {
    const count = tabs.length;
    const next = ((from + direction) % count + count) % count;
    const tab = tabs[next];
    if (tab === undefined) return;
    onChange(tab.value);
    /* Focus follows selection, which is the pattern for tabs whose panels are already rendered:
       the arrow key both moves and switches, so a keyboard sees the same thing a pointer does
       after one key rather than after two. */
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        move(index, 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        move(index, -1);
        break;
      case 'Home':
        event.preventDefault();
        move(-1, 1);
        break;
      case 'End':
        event.preventDefault();
        move(0, -1);
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      data-ds="tablist"
      style={{
        display: 'flex',
        gap: 22,
        padding: '0 2px',
      }}
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          ref={(element) => {
            refs.current[index] = element;
          }}
          id={panelId === undefined ? undefined : `${panelId}-tab-${tab.value}`}
          aria-selected={tab.value === value}
          aria-controls={panelId}
          /* One tab stop for the whole strip: the current tab is in the tab order and the rest
             are reached with the arrows. */
          tabIndex={tab.value === value ? 0 : -1}
          data-ds="tab"
          data-hit-target=""
          data-selected={tab.value === value ? 'true' : undefined}
          onClick={() => {
            onChange(tab.value);
          }}
          onKeyDown={(event) => {
            onKeyDown(event, index);
          }}
          style={{
            border: 'none',
            background: 'transparent',
            padding: '0 2px 10px',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-semibold)',
            transition: 'color var(--transition-state), box-shadow var(--transition-state)',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
