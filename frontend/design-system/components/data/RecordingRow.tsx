import type { HTMLAttributes, KeyboardEvent } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';
import { StateBadge } from './StateBadge';

export interface RecordingRowProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  /** Formatted duration, mono and tabular. */
  duration: string;
  state?: TranscriptionState;
  peaks?: Peaks | undefined;
  played?: number;
  pending?: boolean;
  /** Row is the current selection or the playing recording. */
  selected?: boolean;
  onOpen?: () => void;
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
  state = 'done',
  peaks,
  played = 0,
  pending = false,
  selected = false,
  onOpen,
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
      style={{
        height: 'var(--row-height)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '0 12px',
        background: selected ? 'var(--surface-2)' : 'transparent',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background var(--transition-state)',
        ...style,
      }}
      {...rest}
    >
      <StateBadge state={state} variant="glyph" />
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
      <div style={{ width: 88, flex: '0 0 auto' }}>
        <Waveform peaks={peaks} size="dense" played={played} pending={pending} />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-numeric-size)',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--text-3)',
          width: 46,
          textAlign: 'right',
          flex: '0 0 auto',
        }}
      >
        {duration}
      </span>
    </div>
  );
}
