/**
 * The shape of whatever is playing (`UI-5c`, §3.1).
 *
 * The player is the surface that draws it, so the player is what asks for it: the shell renders
 * the bar on every route and has no reason to know that a waveform is a second request, and a
 * `peaks` prop threaded down from there is a prop nothing fills in.
 *
 * **`BUCKETS.detail`, because the bar is wider than it was taken to be.** This asked for
 * `BUCKETS.card` on the grounds that the bar draws about a hundred bars, so 160 would be more
 * than it could show, and asking for the count the cards already hold made playing from a list a
 * cache hit. The bar's waveform is `flex: 1`, though: at 1220px it has room for 262 bars at the
 * token pitch, and peaks are never interpolated up (`UI-2a`) -- so it drew 160, spanning 742px of
 * a 1220px slot, with the rest of the surface empty. That is a picture that stops before its
 * recording does, and now that the bar is a seek control it is also 478px of it that lands on
 * either end. The cost is a request when playback starts from a list rather than from the
 * recording, which is a few kilobytes for a control that reaches the whole recording.
 */

import { BUCKETS, useWaveform } from '@/api/waveform';
import type { Peaks } from '@/api/waveform';

import { usePlayback } from './store';

/** The peaks for the recording being played, or nothing when there is no shape to draw. */
export function usePlayingPeaks(wanted: boolean): Peaks | undefined {
  const recording = usePlayback((state) => state.recording);
  // A recording whose peaks job has not run says so on the summary, so the request that would
  // 404 is never made.
  const { peaks } = useWaveform(
    recording?.uuid ?? '',
    BUCKETS.detail,
    wanted && recording?.hasWaveform === true,
  );
  // Answered rather than just left unasked: a query that is disabled still hands back whatever a
  // card fetched a moment ago, and the surface that must draw nothing has to be given nothing.
  return wanted ? peaks : undefined;
}
