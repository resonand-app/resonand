/**
 * The shape of the last thing added to a library (`UI-31b`, §V2).
 *
 * Two requests per card -- which recording is the most recent, then its peaks -- and §V2 calls
 * that "a real cost for a landing page" in as many words. Three things keep it honest:
 *
 * **Nothing is asked for until the cards are on screen.** The gate is an effect, so it runs after
 * the first paint: the grid, the names and the counts are drawn from one list request, and the
 * pictures arrive into a page somebody is already reading. A card with no waveform is a correct
 * card, not a broken one, so nothing waits for this.
 *
 * **An empty library asks for nothing at all.** `audio_count` is already on the summary, so the
 * question "what is the most recent recording" is not asked where the answer is known to be none.
 *
 * **The peaks are reduced on the server to what the card draws.** `--card-width` is 320px and the
 * bars are drawn from a token, so a few hundred buckets is more than the picture can show; asking
 * for the stored 28,800 would be asking for a megabyte to draw a thumbnail (`ING-14`).
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import { BUCKETS, useWaveform } from '@/api/waveform';
import type { Peaks } from '@/api/waveform';

export interface LatestWaveform {
  peaks: Peaks | undefined;
  /** True until there is a shape to draw -- including for a recording whose peaks job has not run. */
  pending: boolean;
}

export function useLatestWaveform(
  library: { uuid: string; audio_count: number },
  enabled: boolean,
): LatestWaveform {
  const hasRecordings = library.audio_count > 0;

  // Which one is most recent is the upload order, not the recording date: the card says whether
  // a library has been added to lately, and a cassette digitised last week was recorded in 1998.
  const latest = useQuery({
    queryKey: keys.libraryAudio(library.uuid, { latest: true }),
    queryFn: () =>
      get('/api/libraries/{library_uuid}/audio', {
        path: { library_uuid: library.uuid },
        query: { limit: 1, sort: 'created_at', direction: 'desc' },
      }),
    enabled: enabled && hasRecordings,
  });

  const recording = latest.data?.items[0];
  const uuid = recording?.uuid;

  // A recording whose peaks job has not run says so on the summary, so the request that would
  // 404 is never made (`ING-14`). The card stays `pending`, which is what it should say.
  return useWaveform(uuid ?? '', BUCKETS.card, enabled && recording?.has_waveform === true);
}
