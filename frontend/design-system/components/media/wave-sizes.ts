/**
 * The five sizes the waveform appears at, and nowhere else (`UI-2b`).
 *
 * Named rather than measured in pixels, because the height is a token and a caller repeating its
 * value is a caller that will disagree with it. Each maps to a `--wave-height-*` token: changing
 * one of those changes the drawing, which is the criterion this task is held to.
 *
 * Its own module so that `Waveform.tsx` exports only a component, which is what lets fast refresh
 * replace it without remounting the tree it sits in.
 */

export const WAVE_SIZES = ['dense', 'card', 'record', 'player', 'detail'] as const;

/** One of the five. There is no sixth, and no arbitrary height. */
export type WaveSize = (typeof WAVE_SIZES)[number];

/** The token each size reads its height from. */
export const HEIGHT_TOKEN: Record<WaveSize, string> = {
  dense: '--wave-height-dense',
  card: '--wave-height-card',
  record: '--wave-height-record',
  player: '--wave-height-player',
  detail: '--wave-height-detail',
};
