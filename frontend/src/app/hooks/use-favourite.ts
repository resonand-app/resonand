/**
 * Marking a favourite, from wherever a recording is drawn (`UI-42`).
 *
 * **Optimistic.** The heart changes the moment it is pressed, in every cached place the recording
 * is drawn -- a library's pages, the list across libraries, search, the recording itself -- and
 * the request follows. A refusal puts every one of them back and says so in a toast. Waiting for
 * the round trip would leave a heart that does nothing for a moment, which reads as a missed press
 * and gets pressed again.
 *
 * **Nothing is refetched afterwards.** Every copy already says what the server now holds, and the
 * one thing the mark changes beyond that -- which recordings the favourites view lists -- is
 * marked stale for the next time that view loads (see `staleAfter`).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { put, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import { raiseToast } from '@/app/toasts';

/** Every cached thing a recording can be drawn from. */
const DRAWN = [keys.libraries(), keys.everyRecording(), keys.search()] as const;

/** Mark or unmark a recording: `(uuid, on)`. */
export function useFavourite(): (uuid: string, on: boolean) => void {
  const { t } = useTranslation('common');
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ uuid, on }: { uuid: string; on: boolean }) =>
      on
        ? put('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: uuid } })
        : remove('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: uuid } }),
    onMutate: async ({ uuid, on }) => {
      // A page already in flight would land on top of the mark and undo it on screen.
      await Promise.all(
        [...DRAWN, keys.recording(uuid)].map((queryKey) =>
          client.cancelQueries({ queryKey: [...queryKey] }),
        ),
      );
      mark(client, uuid, on);
    },
    onError: (_error, { uuid, on }) => {
      mark(client, uuid, !on);
      raiseToast({
        tone: 'failed',
        message: on ? t('favourite.markFailed') : t('favourite.unmarkFailed'),
      });
    },
    onSuccess: async (_data, { uuid }) => {
      await invalidate(client, { kind: 'favourite', recording: uuid });
    },
    // Said above, in words about the heart rather than the API's about a request.
    meta: { handled: true },
  });
  return (uuid, on) => {
    mutation.mutate({ uuid, on });
  };
}

/** Set the mark on every cached copy of one recording. */
export function mark(client: QueryClient, uuid: string, on: boolean): void {
  for (const queryKey of [...DRAWN, keys.recording(uuid)]) {
    client.setQueriesData({ queryKey: [...queryKey] }, (data: unknown) => withMark(data, uuid, on));
  }
}

/**
 * One cached value with the mark set, and the same value back when the recording is not in it.
 *
 * The shapes are the four a recording is cached in: itself, a page of them, the pages of a grid,
 * and a page of search results that each hold one.
 */
function withMark(data: unknown, uuid: string, on: boolean): unknown {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;
  const value = data as Record<string, unknown>;
  if (Array.isArray(value.pages)) return each(value, 'pages', uuid, on);
  if (Array.isArray(value.items)) return each(value, 'items', uuid, on);
  if (value.audio !== undefined) {
    const audio = withMark(value.audio, uuid, on);
    return audio === value.audio ? data : { ...value, audio };
  }
  if (value.uuid === uuid && typeof value.is_favourite === 'boolean' && value.is_favourite !== on) {
    return { ...value, is_favourite: on };
  }
  return data;
}

function each(value: Record<string, unknown>, field: string, uuid: string, on: boolean): unknown {
  const before = value[field] as unknown[];
  const after = before.map((one) => withMark(one, uuid, on));
  return after.every((one, index) => one === before[index]) ? value : { ...value, [field]: after };
}
