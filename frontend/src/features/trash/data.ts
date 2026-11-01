/**
 * What is in the trash, as one list (`INT-1a`, `INT-1b`, §V9).
 *
 * **Two endpoints, one list.** `GET /trash/audio` and `GET /trash/libraries` are separate calls
 * because they are separate resources, but the question somebody arrives with is *where did that
 * go* -- not *was it a library* -- so they are merged here and the view never sees two
 * collections. Merging in the data layer rather than in the component is what keeps the ordering
 * rule in one place: both endpoints already sort closest-to-purge first, and the merge has to
 * preserve that across them.
 *
 * **A trashed recording inside a trashed library is grouped under it** rather than listed twice.
 * Restoring that recording on its own puts it back into a library that is still in the trash,
 * where nobody would see it -- which is a real case with a real answer on screen (`INT-1b`), and
 * the grouping is what makes the answer possible to draw.
 *
 * **The time left is computed, never stored.** `deleted_at` is a fact and the retention is an
 * instance setting, so how long something has is the difference between them -- read from
 * `GET /instance` (`API-14`) rather than written into the bundle, because an operator who set 7
 * days would otherwise be shown 30.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { get, post, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import { usePaged } from '@/api/paged';
import type { PagedResult } from '@/api/paged';
import type { components } from '@/api/contract/schema';

type Schemas = components['schemas'];
export type TrashedLibrary = Schemas['LibrarySummary'];
export type TrashedRecording = Schemas['AudioSummary'];
export type TrashSummary = Schemas['TrashSummary'];
export type TrashTally = Schemas['TrashTally'];
export type PurgeResult = Schemas['PurgeResult'];

/** One row of the merged list: a library with whatever is grouped under it, or a recording. */
export type TrashEntry =
  | { kind: 'library'; deletedAt: string; library: TrashedLibrary; children: TrashedRecording[] }
  | { kind: 'recording'; deletedAt: string; recording: TrashedRecording };

export interface Trash {
  entries: TrashEntry[];
  /** Every trashed thing, libraries and recordings alike, for the count the empty state is not. */
  total: number;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * The trash, merged and grouped.
 *
 * Both halves are paged the same way and both are asked for in full at the default page size:
 * a trash is not a library, and somebody with more than fifty deleted things has a different
 * problem than pagination. `hasMore` is surfaced so the view can say so rather than silently
 * showing part of it.
 */
export function useTrash(): Trash & { hasMore: boolean } {
  const recordings: PagedResult<TrashedRecording> = usePaged(keys.trashedAudio(), () =>
    get('/api/trash/audio', { query: {} }),
  );
  const libraries: PagedResult<TrashedLibrary> = usePaged(keys.trashedLibraries(), () =>
    get('/api/trash/libraries', { query: {} }),
  );

  return {
    entries: merge(libraries.items, recordings.items),
    total: libraries.total + recordings.total,
    hasMore: libraries.hasMore || recordings.hasMore,
    isPending: recordings.isPending || libraries.isPending,
    error: recordings.error ?? libraries.error,
    refetch: () => {
      void recordings.refetch();
      void libraries.refetch();
    },
  };
}

/**
 * One list out of two, closest to being purged first.
 *
 * Exported so the ordering and the grouping can be tested as the rules they are, without a
 * network or a frame around them.
 *
 * A recording is grouped under a library only when **that library is itself in the trash**. A
 * recording trashed out of a library that is still there is a top-level row: its library is not
 * going anywhere and saying so would be noise.
 */
export function merge(libraries: TrashedLibrary[], recordings: TrashedRecording[]): TrashEntry[] {
  const trashed = new Set(libraries.map((one) => one.uuid));
  const entries: TrashEntry[] = libraries.map((library) => ({
    kind: 'library',
    // A trashed library always has a `deleted_at`; the type allows null because the same shape
    // describes a live one, and the endpoint that answered this only returns trashed ones.
    deletedAt: library.deleted_at ?? '',
    library,
    children: recordings.filter((one) => one.library_uuid === library.uuid),
  }));
  for (const recording of recordings) {
    if (trashed.has(recording.library_uuid)) continue;
    entries.push({ kind: 'recording', deletedAt: recording.deleted_at ?? '', recording });
  }
  // Closest to being purged first, which is what both endpoints already answer with -- so the
  // merge sorts on the same key rather than inventing a second order across them.
  return entries.sort((left, right) => left.deletedAt.localeCompare(right.deletedAt));
}

export interface TrashActions {
  restoreRecording: UseMutationResult<unknown, unknown, TrashedRecording>;
  restoreLibrary: UseMutationResult<unknown, unknown, TrashedLibrary>;
  purgeRecording: UseMutationResult<unknown, unknown, TrashedRecording>;
  purgeLibrary: UseMutationResult<unknown, unknown, TrashedLibrary>;
}

/**
 * Restoring and destroying, one call per item (`INT-1c`).
 *
 * Four mutations rather than two with a flag, because they are four endpoints and two of them
 * cannot be undone. A single `act(kind, permanent)` would put the irreversible call one boolean
 * away from the reversible one, which is the same reason `API-19` gave the purge a path of its
 * own instead of a query parameter.
 *
 * Destroying many at once is `useBulkPurge`, one call rather than many of these.
 */
export function useTrashActions(): TrashActions {
  const client = useQueryClient();
  const settleRecording = async (recording: TrashedRecording) => {
    await invalidate(client, {
      kind: 'recording-lifecycle',
      recording: recording.uuid,
      library: recording.library_uuid,
    });
  };
  const settleLibrary = async (library: TrashedLibrary) => {
    await invalidate(client, { kind: 'library', library: library.uuid });
  };

  return {
    restoreRecording: useMutation({
      mutationFn: (recording: TrashedRecording) =>
        post('/api/audio/{audio_uuid}/restore', { path: { audio_uuid: recording.uuid } }),
      onSuccess: (_answer, recording) => settleRecording(recording),
    }),
    restoreLibrary: useMutation({
      mutationFn: (library: TrashedLibrary) =>
        post('/api/libraries/{library_uuid}/restore', { path: { library_uuid: library.uuid } }),
      onSuccess: (_answer, library) => settleLibrary(library),
    }),
    purgeRecording: useMutation({
      mutationFn: (recording: TrashedRecording) =>
        remove('/api/trash/audio/{audio_uuid}', { path: { audio_uuid: recording.uuid } }),
      onSuccess: (_answer, recording) => settleRecording(recording),
    }),
    purgeLibrary: useMutation({
      mutationFn: (library: TrashedLibrary) =>
        remove('/api/trash/libraries/{library_uuid}', { path: { library_uuid: library.uuid } }),
      onSuccess: (_answer, library) => settleLibrary(library),
    }),
  };
}

/**
 * What emptying the trash would destroy, counted now (`API-28`).
 *
 * Only while a confirmation is open, and never from the cache: the numbers are what somebody is
 * agreeing to, and the instant they come with is what bounds the empty.
 */
export function useTrashSummary(open: boolean): UseQueryResult<TrashSummary> {
  return useQuery({
    queryKey: keys.trashSummary(),
    queryFn: () => get('/api/trash/summary'),
    enabled: open,
    staleTime: 0,
    gcTime: 0,
  });
}

export interface BulkPurge {
  /** A selection: libraries with all they hold, and recordings outside them. */
  purgeSelection: UseMutationResult<PurgeResult, unknown, Schemas['PurgeSelection']>;
  /** The whole trash as it stood at the summary's `counted_at`, and nothing trashed since. */
  emptyTrash: UseMutationResult<TrashTally, unknown, string>;
}

/** Destroying much of the trash in one call each (`INT-8`). */
export function useBulkPurge(): BulkPurge {
  const client = useQueryClient();
  const settle = () => invalidate(client, { kind: 'trash-destroyed' });
  return {
    purgeSelection: useMutation({
      mutationFn: (body: Schemas['PurgeSelection']) => post('/api/trash/purge', { body }),
      onSettled: settle,
    }),
    emptyTrash: useMutation({
      mutationFn: (countedAt: string) =>
        remove('/api/trash', { query: { trashed_before: countedAt } }),
      onSettled: settle,
    }),
  };
}
