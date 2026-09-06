/**
 * The four transcription states, and the one place they are named (`UI-1g`).
 *
 * Its own module rather than a second export from `StateBadge`, because the badge is not the only
 * thing that has to say these words. `UI-8c` puts the same four on the filter bar as toggles and
 * is explicit that they share the badge's vocabulary "so the filter and the badge cannot say
 * different words" -- and two lists in two files is exactly how they come to.
 *
 * The states are **derived rather than stored**: `done` is an active transcript, `running` and
 * `failed` are the transcribe job's state, and `none` is the absence of both (`JOB-11b`). What is
 * declared here is only how each one looks and reads.
 *
 * Each carries a glyph and a word, because **colour is never the only signal** -- `UI-6b` requires
 * the four to be distinguishable without it.
 */

import type { IconName } from './components/foundation/Icon';

export const TRANSCRIPTION_STATES = {
  none: { label: 'No transcript', icon: 'circle-dashed', color: 'var(--state-none)' },
  running: { label: 'In progress', icon: 'loader', color: 'var(--state-running)' },
  done: { label: 'Done', icon: 'check', color: 'var(--state-done)' },
  failed: { label: 'Failed', icon: 'alert-circle', color: 'var(--state-failed)' },
} as const satisfies Record<string, { label: string; icon: IconName; color: string }>;

/** One of the four states the API reports. */
export type TranscriptionState = keyof typeof TRANSCRIPTION_STATES;

/** The four, in the order they are offered as filters. */
export const TRANSCRIPTION_STATE_NAMES = Object.keys(
  TRANSCRIPTION_STATES,
) as readonly TranscriptionState[];
