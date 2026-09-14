/**
 * Correcting a recording's own fields (`UI-13a`, `UI-13c`, §V5).
 *
 * One mutation for the whole panel, because it is one endpoint: `PATCH /audio/{uuid}` takes any
 * subset of the fields and answers with the recording as it now stands. So a field says what it
 * changed and nothing else, and the panel does not assemble a form -- there is no Save button
 * anywhere on it, which is `InlineField`'s whole interaction model.
 *
 * **Absent and null are different things and the endpoint reads them as such.** A field left out
 * is unchanged; `notes: null` clears the notes. Clearing a category is neither: it is
 * `clear_category: true`, because `category_id: null` would be indistinguishable from "leave the
 * category alone" in JSON (`UI-13c`).
 *
 * **Tags go as names and not as slugs.** The backend owns normalisation and the first writer owns
 * a tag's display name, so what is sent is the canonical name the autocomplete offered rather
 * than the one somebody typed -- otherwise `Interview` typed twice with different accents becomes
 * one tag whose display name is whichever spelling was saved last.
 *
 * The cache is told what changed rather than which keys to drop: a corrected title is a different
 * search result and a different card in two lists, and `invalidate` is the one place that knows
 * it (`UI-3c`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { patch } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';

import type { RecordingDetail } from './data';

export type MetadataPatch = components['schemas']['UpdateAudio'];

export type Update = UseMutationResult<RecordingDetail, unknown, MetadataPatch>;

export function useUpdateRecording(uuid: string, libraryUuid: string): Update {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: MetadataPatch) =>
      patch('/api/audio/{audio_uuid}', { path: { audio_uuid: uuid }, body }),
    onSuccess: async (updated) => {
      // The answer is the recording as it now stands, so it is put straight into the cache: the
      // panel is looking at that query, and a refetch before the invalidation lands would show
      // the old value for one frame.
      client.setQueryData([...keys.recording(uuid)], updated);
      await invalidate(client, { kind: 'recording', recording: uuid, library: libraryUuid });
    },
  });
}
