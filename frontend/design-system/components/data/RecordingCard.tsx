import type { HTMLAttributes } from 'react';

import type { TranscriptionState } from '../../transcription-states';
import { IconButton } from '../forms/IconButton';
import type { Peaks } from '../media/peaks';
import { Waveform } from '../media/Waveform';
import { Chip } from './Chip';
import { StateBadge } from './StateBadge';

export interface RecordingCardProps extends HTMLAttributes<HTMLElement> {
  name: string;
  /** Mono metadata: duration and date, e.g. "48:12 · 12 Mar 2026". */
  meta?: string;
  state?: TranscriptionState;
  /** User-entered tags, shown verbatim. */
  tags?: string[];
  peaks?: Peaks | undefined;
  played?: number;
  pending?: boolean;
  onPlay?: () => void;
}

/**
 * A recording as a card, for the grid view of a library.
 *
 * The play control is a real button in the corner, which is what leaves the opposite corner free
 * for `UI-9a`'s selection checkbox -- the two must not fight, because selecting forty recordings
 * and playing one are things people do in the same minute.
 *
 * It asks for `variant="accent-soft"` rather than passing the same two colours through `style`,
 * which is what it did until `UI-32a` -- and an inline background is a paint no hover rule can
 * reach, so the card's play button was one of the two controls in the product that did not
 * respond to a pointer.
 */
export function RecordingCard({
  name,
  meta,
  state = 'done',
  tags = [],
  peaks,
  played = 0,
  pending = false,
  onPlay,
  style,
  ...rest
}: RecordingCardProps) {
  return (
    <article
      data-ds="recording-card"
      style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-card)',
        padding: '14px var(--panel-padding)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        ...style,
      }}
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--weight-semibold)',
              fontSize: 'var(--type-body-size)',
              letterSpacing: '-0.005em',
              color: 'var(--text)',
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-numeric-size)',
              fontVariantNumeric: 'var(--type-numeric-variant)',
              color: 'var(--text-3)',
            }}
          >
            {meta}
          </span>
        </div>
        <IconButton icon="play" variant="accent-soft" size={32} label={`Play ${name}`} onClick={onPlay} />
      </div>
      <Waveform
        peaks={peaks}
        size="record"
        played={played}
        playhead={played > 0}
        pending={pending}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StateBadge state={state} />
        {tags.map((tag) => (
          <Chip key={tag}>{tag}</Chip>
        ))}
      </div>
    </article>
  );
}
