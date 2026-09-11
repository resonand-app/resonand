/**
 * The shape of whatever is playing (`UI-5c`, §3.1).
 *
 * The player is the surface that draws it, so the player is what asks for it: the shell renders
 * the bar on every route and has no reason to know that a waveform is a second request, and a
 * `peaks` prop threaded down from there is a prop nothing fills in.
 *
 * `BUCKETS.card` rather than a count of its own. The bar draws about a hundred bars and the phone
 * player about eighty, so 160 is more than either can show -- and it is the count the cards and
 * the rows already hold, which makes playing a recording from a list a cache hit rather than a
 * request for the same picture at a different size.
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
    BUCKETS.card,
    wanted && recording?.hasWaveform === true,
  );
  // Answered rather than just left unasked: a query that is disabled still hands back whatever a
  // card fetched a moment ago, and the surface that must draw nothing has to be given nothing.
  return wanted ? peaks : undefined;
}
