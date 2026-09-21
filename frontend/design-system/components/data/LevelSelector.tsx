import type { KeyboardEvent } from 'react';
import { useRef } from 'react';

/** The level the API stores. 10 read, 20 edit, 30 manage; 40 is ownership and is never granted. */
export const OWNER_LEVEL = 40;

export interface LevelOption {
  /** `Level` as the API returns it. */
  level: number;
  /**
   * `level_description` from the API, verbatim.
   *
   * "Can read: listen and read the transcript, and change nothing." The name and the sentence
   * arrive as one string on purpose -- see the component's note on why nothing here rewrites it.
   */
  description: string;
}

export interface LevelSelectorProps {
  levels: LevelOption[];
  value?: number | undefined;
  onChange: (level: number) => void;
  /** Names the group: "What Sam Rivera can do". */
  label: string;
  disabled?: boolean;
}

/**
 * Splits `level_description` into the name and the sentence.
 *
 * The API sends one string -- "Can read: listen and read the transcript, and change nothing." --
 * and the design draws two lines. Splitting at the first colon is how both are true at once: the
 * words are the API's, in the API's order, and nothing here decides what a level means. A
 * description with no colon is drawn whole, which is what happens if the backend ever rewords
 * them.
 */
function split(description: string): { name: string; rest: string | undefined } {
  const at = description.indexOf(':');
  if (at === -1) return { name: description, rest: undefined };
  return { name: description.slice(0, at), rest: description.slice(at + 1).trim() };
}

/**
 * Can read / Can edit / Can manage, as radio rows with the plain wording visible (`UI-34k`).
 *
 * **It renders the API's `level_description` rather than a copy of it.** The wording lives in
 * `resonand/core/levels.py`, beside the levels themselves, and is sent down with every share --
 * so this component has no strings of its own to go stale. A second copy in the interface would
 * be a second copy that somebody eventually edits, and then the product describes a permission it
 * does not grant.
 *
 * **The wording is visible, never behind a tooltip** (`UI-34j` says the same thing from the other
 * side). Sharing is where the product's first hard promise is kept or broken -- nothing is shared
 * until you share it -- and a person choosing a level has to be able to read what it does at the
 * moment they choose it, on a phone, without a pointer.
 *
 * **Owner is never selectable.** It is not a grant: the backend reads it off `library.owner_id`
 * and a `CHECK` refuses a share row carrying it. If one arrives in `levels` anyway it is dropped
 * here rather than drawn and disabled, for `UI-34c`'s reason -- an option nobody can ever pick is
 * an option that should not be in the list.
 */
export function LevelSelector({ levels, value, onChange, label, disabled = false }: LevelSelectorProps) {
  const grantable = levels.filter((option) => option.level !== OWNER_LEVEL);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = (from: number, direction: 1 | -1) => {
    const count = grantable.length;
    if (count === 0) return;
    const next = (((from + direction) % count) + count) % count;
    const option = grantable[next];
    if (option === undefined) return;
    onChange(option.level);
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

  const selectedIndex = grantable.findIndex((option) => option.level === value);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {grantable.map((option, index) => {
        const { name, rest } = split(option.description);
        const selected = option.level === value;
        return (
          <button
            key={option.level}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            ref={(element) => {
              refs.current[index] = element;
            }}
            /* One tab stop for the group: the chosen level is in the tab order and the arrows
               move between the three. Nothing chosen yet puts the stop on the first. */
            tabIndex={selected || (selectedIndex === -1 && index === 0) ? 0 : -1}
            data-ds="level-row"
            data-hit-target=""
            data-selected={selected ? 'true' : undefined}
            onClick={() => {
              onChange(option.level);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            style={{
              display: 'flex',
              gap: 11,
              padding: '11px 12px',
              border: 'none',
              borderRadius: 'var(--radius-control)',
              textAlign: 'left',
              fontFamily: 'var(--font-sans)',
              transition: 'background var(--transition-state)',
            }}
          >
            <span
              data-ds="level-dot"
              aria-hidden
              style={{
                flex: '0 0 auto',
                width: 16,
                height: 16,
                marginTop: 2,
                borderRadius: 'var(--radius-circle)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <span
                data-ds="level-dot-fill"
                style={{ width: 8, height: 8, borderRadius: 'var(--radius-circle)' }}
              />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 'var(--type-ui-size)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--text)',
                }}
              >
                {name}
              </span>
              {rest !== undefined && (
                <span
                  style={{
                    fontSize: 'var(--type-ui-size-sm)',
                    lineHeight: 'var(--type-ui-leading)',
                    color: 'var(--text-3)',
                  }}
                >
                  {rest}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
