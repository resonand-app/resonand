import type { HTMLAttributes } from 'react';

import { TRANSCRIPTION_STATES } from '../../transcription-states';
import type { TranscriptionState } from '../../transcription-states';
import { Icon } from '../foundation/Icon';

export interface StateBadgeProps extends HTMLAttributes<HTMLElement> {
  /** One of the four states the API reports. */
  state?: TranscriptionState;
  /** `chip` in cards and detail views; `glyph` in 36px dense rows where there is no room for a word. */
  variant?: 'chip' | 'glyph';
}

/**
 * Transcription state, always as a glyph and a word.
 *
 * Colour is never the only signal: the four have to be told apart by somebody who cannot see the
 * difference between the green and the red. In the `glyph` variant the word survives as the
 * title, because a 36px dense row has no space for it and no excuse for dropping it.
 */
export function StateBadge({ state = 'none', variant = 'chip', style, ...rest }: StateBadgeProps) {
  const meaning = TRANSCRIPTION_STATES[state];

  if (variant === 'glyph') {
    return (
      <Icon
        name={meaning.icon}
        size={15}
        color={meaning.color}
        title={meaning.label}
        style={style}
        {...rest}
      />
    );
  }

  const background =
    state === 'done'
      ? 'var(--state-done-bg)'
      : state === 'failed'
        ? 'var(--state-failed-bg)'
        : 'var(--surface-2)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 10px',
        borderRadius: 'var(--radius-pill)',
        background,
        color: meaning.color,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        ...style,
      }}
      {...rest}
    >
      <Icon name={meaning.icon} size={13} />
      {meaning.label}
    </span>
  );
}
