import type { HTMLAttributes, KeyboardEvent } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';
import { IconButton } from '../forms/IconButton';
import { Chip } from './Chip';
import { StateBadge } from './StateBadge';

export interface RecordingRowProps extends HTMLAttributes<HTMLDivElement> {
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
  peaks?: Peaks | undefined;
  played?: number;
  pending?: boolean;
  /** Row is the current selection or the playing recording. */
  selected?: boolean;
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
 */
export function RecordingRow({
  name,
  duration,
  date,
  category,
  tags = [],
  state = 'done',
  peaks,
  played = 0,
  pending = false,
  selected = false,
  playing = false,
  onOpen,
  onPlay,
  labels,
  onKeyDown,
  style,
  ...rest
}: RecordingRowProps) {
  const interactive = onOpen !== undefined;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (!interactive || event.defaultPrevented) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      onClick={onOpen}
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
      <div data-column="waveform" style={{ width: 88, flex: '0 0 auto' }}>
        <Waveform peaks={peaks} size="dense" played={played} pending={pending} />
      </div>
      {date !== undefined && (
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
      )}
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
      {category !== undefined && (
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
      )}
      {tags.length > 0 && (
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
      )}
    </div>
  );
}
