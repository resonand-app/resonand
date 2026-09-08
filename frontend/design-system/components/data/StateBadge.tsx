import type { HTMLAttributes } from 'react';

import { TRANSCRIPTION_STATES } from '../../transcription-states';
import type { TranscriptionState } from '../../transcription-states';
import { Icon } from '../foundation/Icon';

export interface StateBadgeProps extends HTMLAttributes<HTMLElement> {
  /** One of the four states the API reports. */
  state?: TranscriptionState;
  /** `chip` in cards and detail views; `glyph` in 36px dense rows where there is no room for a word. */
  variant?: 'chip' | 'glyph';
  /**
   * The state's name, for an application that has its own (`UI-22a`).
   *
   * The vocabulary in `transcription-states.ts` is English, and it is one vocabulary on purpose:
   * `UI-8c` puts the same four words on the filter bar so a toggle and a badge cannot disagree.
   * Translating it is the application's job, and this is where the translation arrives.
   */
  label?: string;
}

/**
 * Transcription state, always as a glyph and a word.
 *
 * Colour is never the only signal: the four have to be told apart by somebody who cannot see the
 * difference between the green and the red. In the `glyph` variant the word survives as the
 * title, because a 36px dense row has no space for it and no excuse for dropping it.
 */
export function StateBadge({
  state = 'none',
  variant = 'chip',
  label,
  style,
  ...rest
}: StateBadgeProps) {
  const meaning = TRANSCRIPTION_STATES[state];
  const word = label ?? meaning.label;

  if (variant === 'glyph') {
    return (
      <Icon
        name={meaning.icon}
        size={15}
        color={meaning.color}
        title={word}
        data-ds="state-badge"
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
      data-ds="state-badge"
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
      {word}
    </span>
  );
}
