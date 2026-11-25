import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';

import { Icon } from '../foundation/Icon';
import { initialsOf } from './initials';

export interface PersonOption {
  id: number;
  /** The account's display name, verbatim. */
  name: string;
}

export interface PersonPickerProps {
  people: readonly PersonOption[];
  /** Who is chosen, in any order. */
  value: readonly number[];
  /** The whole new set, in the order `people` lists them. */
  onChange: (ids: number[]) => void;
  /** Names the group: "Who to share with". */
  label: string;
}

/**
 * Any number of people out of a list, as a wrapping grid of boxes with their initials (`UI-49`).
 *
 * **Toggles, not buttons.** Choosing somebody does nothing yet -- the level and the confirmation
 * come after -- so a box says it is chosen and waits. One tab stop for the grid, as
 * `LevelSelector` beside it has: the arrows move between the boxes and `Space` or `Enter` turns
 * the one in focus on or off, so the keyboard never chooses somebody by passing over them.
 *
 * **Initials and never an image**, for `AvatarStack`'s reason: there is no storage for one, and
 * fetching one would break the promise that nothing leaves the instance. A chosen box swaps its
 * initials for a tick, so several chosen at once read as chosen rather than as highlighted.
 *
 * **It does not decide who is in the list.** Whoever cannot be chosen -- the owner, somebody who
 * already has access -- is left out by the caller rather than drawn disabled, because an option
 * nobody can pick is not an option.
 */
export function PersonPicker({ people, value, onChange, label }: PersonPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focused, setFocused] = useState(0);
  const chosen = new Set(value);
  const stop = Math.min(focused, Math.max(0, people.length - 1));

  const toggle = (id: number) => {
    const next = chosen.has(id) ? value.filter((one) => one !== id) : [...value, id];
    const order = new Map(people.map((person, index) => [person.id, index]));
    onChange(next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
  };

  const move = (from: number, direction: 1 | -1) => {
    const count = people.length;
    if (count === 0) return;
    const next = (((from + direction) % count) + count) % count;
    setFocused(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(index, -1);
    }
  };

  return (
    <div
      role="group"
      aria-label={label}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(10rem, 1fr))',
        gap: 'var(--space-2)',
      }}
    >
      {people.map((person, index) => {
        const selected = chosen.has(person.id);
        return (
          <button
            key={person.id}
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={person.name}
            ref={(element) => {
              refs.current[index] = element;
            }}
            tabIndex={index === stop ? 0 : -1}
            data-ds="person-option"
            data-hit-target=""
            data-selected={selected ? 'true' : undefined}
            title={person.name}
            onFocus={() => {
              setFocused(index);
            }}
            onClick={() => {
              toggle(person.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 52,
              minWidth: 0,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-state)',
            }}
          >
            <span
              data-ds="person-initials"
              aria-hidden
              style={{
                flex: '0 0 auto',
                width: 32,
                height: 32,
                borderRadius: 'var(--radius-circle)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: 'var(--font-mono)',
                fontWeight: 'var(--weight-medium)',
                fontSize: 'var(--type-overline-size)',
              }}
            >
              {selected ? <Icon name="check" size={16} /> : initialsOf(person.name)}
            </span>
            {/* Cut rather than wrapped, so the boxes in a row stay one height; the whole name is
                the box's title and its accessible name. */}
            <span
              style={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'var(--type-ui-size)',
                fontWeight: 'var(--weight-medium)',
                color: 'var(--text)',
              }}
            >
              {person.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
