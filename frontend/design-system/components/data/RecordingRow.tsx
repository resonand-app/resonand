import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import { Checkbox } from '../forms/Checkbox';
import { IconButton } from '../forms/IconButton';
import { Chip } from './Chip';
import { StateBadge } from './StateBadge';

// `onSelect` hands back whether it is now selected rather than a DOM event, and `HTMLAttributes`
// already has one. Omitting it is what lets the narrower signature stand rather than silently
// shadow a native handler -- the same arrangement `Sidebar` makes for the same reason.
export interface RecordingRowProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  name: string;
  /** Formatted duration, mono and tabular. */
  duration: string;
  /**
   * The recording's own date, formatted by the application (§1.3).
   *
   * A string, because the wall between a recording's wall-clock reading and an instant is the
   * application's to hold: a row given a `Date` would be a row that could render the wrong
   * evening.
   */
  date?: string;
  /** The category's name, resolved against the library's tree by the caller. */
  category?: string;
  /** User-entered tags, shown verbatim. */
  tags?: string[];
  state?: TranscriptionState;
  /** Row is the current selection or the playing recording. */
  selected?: boolean;
  /** The selection control, in its own column (`UI-9a`). Absent where selection is not offered. */
  onSelect?: (selected: boolean) => void;
  /** Whether this is the recording the player is playing (`UI-7a`). */
  playing?: boolean;
  onOpen?: () => void;
  /**
   * Play this recording. Present in the dense list, where play is one of the four columns that
   * never collapse (§V4), and absent in a specimen that is only showing the row's shape.
   */
  onPlay?: () => void;
  /** The copy, for an application that has its own (`UI-22a`). */
  labels?: {
    play?: (name: string) => string;
    pause?: (name: string) => string;
    state?: string;
    select?: (name: string) => string;
  };
}

/**
 * The dense list row: 36px tall, which is the floor rather than a target.
 *
 * A row that opens is a control, so it is reachable from the keyboard (`UI-1g`) -- the same
 * treatment `TranscriptLine` gets and for the same reason. It has no nested control, which is why
 * it can take a role where `LibraryCard` cannot. `UI-7a` virtualises eight hundred of these and
 * `UI-4g` owns the arrow keys between them; a roving tab stop is theirs to impose, and until then
 * a row nobody can reach without a mouse is the worse of the two problems.
 *
 * **Every column is drawn whether or not it has a value.** A row is only a row next to its
 * neighbours: dropping the cell of a recording with no category slid its tags one column left and
 * its length one column right, so a list where any recording lacked one thing lined up nowhere.
 * There is no waveform column -- a 36px sparkline told nobody anything the grid does not.
 */
export function RecordingRow({
  name,
  duration,
  date,
  category,
  tags = [],
  state = 'done',
  selected = false,
  playing = false,
  onOpen,
  onSelect,
  onPlay,
  labels,
  onKeyDown,
  style,
  ...rest
}: RecordingRowProps) {
  const interactive = onOpen !== undefined;

  /**
   * The row opens the recording; the controls inside it do their own thing.
   *
   * Decided here rather than by stopping propagation in a wrapper around each control: a `<span>`
   * whose only job is to swallow clicks is a non-interactive element with a click handler, which
   * is a thing a screen reader cannot make sense of and jsx-a11y is right to refuse. Asking where
   * the click came from keeps the decision on the element that is actually interactive.
   */
  const open = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target instanceof Element && event.target.closest('[data-ds="row-select"]') !== null) {
      return;
    }
    onOpen?.();
  };

  /**
   * `Enter` opens and `Space` toggles the selection (`UI-9d`, §1.8).
   *
   * Two keys and two different acts, which is the model the specification writes down: a row is
   * a thing you open and a thing you pick, and one key doing both makes the other unreachable
   * from a keyboard. `Space` falls through to the global handler when this row offers no
   * selection, because there it means play or pause and a row that swallowed it would be a row
   * that broke the player.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Enter' && interactive) {
      event.preventDefault();
      onOpen();
      return;
    }
    if (event.key === ' ' && onSelect !== undefined) {
      event.preventDefault();
      onSelect(!selected);
    }
  };

  return (
    <div
      onClick={open}
      onKeyDown={handleKeyDown}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      data-ds="recording-row"
      data-selected={selected ? 'true' : undefined}
      data-playing={playing ? 'true' : undefined}
      style={{
        height: 'var(--row-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '0 12px',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      {onSelect !== undefined && (
        <span data-ds="row-select" style={{ flex: '0 0 auto', display: 'flex' }}>
          <Checkbox
            checked={selected}
            onChange={onSelect}
            size="row"
            label={labels?.select?.(name) ?? `Select ${name}`}
          />
        </span>
      )}
      {onPlay !== undefined && (
        <IconButton
          icon={playing ? 'pause' : 'play'}
          variant="ghost"
          size={26}
          label={
            playing
              ? (labels?.pause?.(name) ?? `Pause ${name}`)
              : (labels?.play?.(name) ?? `Play ${name}`)
          }
          onClick={(event) => {
            // The row opens the recording and the button plays it. Without this the button would
            // do both, and a click on play would leave the list it was meant to keep you in.
            event.stopPropagation();
            onPlay();
          }}
        />
      )}
      <StateBadge
        state={state}
        variant="glyph"
        {...(labels?.state === undefined ? {} : { label: labels.state })}
      />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          color: 'var(--text)',
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {name}
      </span>
      <span
        data-column="date"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'var(--type-numeric-variant)',
          color: 'var(--text-3)',
          width: 104,
          flex: '0 0 auto',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {date}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'var(--type-numeric-variant)',
          color: 'var(--text-3)',
          width: 46,
          textAlign: 'right',
          flex: '0 0 auto',
        }}
      >
        {duration}
      </span>
      <span
        data-column="category"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
          width: 116,
          flex: '0 0 auto',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {category}
      </span>
      <span
        data-column="tags"
        style={{
          display: 'flex',
          gap: 4,
          width: 148,
          flex: '0 0 auto',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {/* One chip per tag, clipped rather than counted: a 36px row has no room for a `+N`
            that would itself take the width of a tag, and the whole column goes at 900 anyway. */}
        {tags.map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
      </span>
    </div>
  );
}
