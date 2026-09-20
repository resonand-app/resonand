/**
 * What administration reads and changes (`INT-3b`, `INT-3c`, `INT-3d`, `INT-3e`).
 *
 * One module for the four sections, because they share the one rule that makes this area
 * different from the rest of Settings: **nothing here reaches out on its own.** Every query is a
 * plain read of state the instance already holds, and the one call that contacts a third party --
 * testing the transcription provider -- is a mutation, so it can only happen because somebody
 * pressed something.
 *
 * `invalidate`'s `administration` change covers the whole `admin` key prefix, which is right:
 * disabling an account changes the user list and the status counts, and retrying a job changes
 * the queue and the counts. Naming them individually would be a second list to forget to update.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { get, post, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';

type Schemas = components['schemas'];
export type AdminUser = Schemas['AdminUser'];
export type CreateAccount = Schemas['CreateAccount'];

/** Every account, with the two facts only an administrator is told (`API-20`). */
export function useUsers(): UseQueryResult<AdminUser[]> {
  return useQuery({
    queryKey: keys.users(),
    queryFn: () => get('/api/admin/users'),
  });
}

export interface UserActions {
  create: UseMutationResult<AdminUser, unknown, CreateAccount>;
  setDisabled: UseMutationResult<AdminUser, unknown, { id: number; disabled: boolean }>;
  destroy: UseMutationResult<unknown, unknown, number>;
  setPassword: UseMutationResult<unknown, unknown, { id: number; password: string }>;
}

/**
 * Creating an account, disabling one, and the delete that is usually refused.
 *
 * Disable and enable are one mutation with a flag rather than two, which is the opposite of the
 * choice `useTrashActions` makes -- and for the same reason. There, the two calls differed in
 * whether they could be undone. Here they are the same reversible act in two directions, and the
 * row that fires them is one control whose label is the direction.
 */
export function useUserActions(): UserActions {
  const client = useQueryClient();
  const settle = async () => {
    await invalidate(client, { kind: 'administration' });
  };

  return {
    create: useMutation({
      mutationFn: (body: CreateAccount) => post('/api/admin/users', { body }),
      onSuccess: settle,
    }),
    setDisabled: useMutation({
      mutationFn: ({ id, disabled }: { id: number; disabled: boolean }) =>
        disabled
          ? post('/api/admin/users/{user_id}/disable', { path: { user_id: id } })
          : post('/api/admin/users/{user_id}/enable', { path: { user_id: id } }),
      onSuccess: settle,
    }),
    destroy: useMutation({
      mutationFn: (id: number) => remove('/api/admin/users/{user_id}', { path: { user_id: id } }),
      onSuccess: settle,
    }),
    // No `settle`: nothing an account list shows changes when a password does, and refetching
    // would only redraw the rows under a dialog that is still open (`API-25`).
    setPassword: useMutation({
      mutationFn: ({ id, password }: { id: number; password: string }) =>
        post('/api/admin/users/{user_id}/password', { path: { user_id: id }, body: { password } }),
    }),
  };
}

/**
 * The provider, as configured and — only if asked — as reached (`INT-3c`).
 *
 * **`reachable` stays `null` until somebody presses the test.** Reading this is a plain read of
 * what the instance holds; nothing here contacts a third party, because a page that quietly
 * reached out to draw a green dot would be a smaller version of the violation principle 2 exists
 * to prevent.
 */
export function useProvider(): UseQueryResult<Schemas['ProviderStatus']> {
  return useQuery({
    queryKey: keys.provider(),
    queryFn: () => get('/api/admin/transcription'),
  });
}

/**
 * Contact the provider, because somebody asked (`INT-3c`).
 *
 * A mutation and not a query, which is the whole design: a query would be free to run on mount,
 * on a refocus, or on a retry after a network blip, and every one of those would be the instance
 * reaching out to a third party without anybody having asked it to. A mutation only fires when
 * something is pressed.
 */
export function useTestProvider(): UseMutationResult<Schemas['ProviderStatus'], unknown, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => post('/api/admin/transcription/test'),
    onSuccess: (answer) => {
      // The answer is the newest truth about the provider, so it replaces the cached one rather
      // than invalidating it -- refetching would ask again and get `reachable: null` back.
      client.setQueryData(keys.provider(), answer);
    },
  });
}

/** How often the queue asks again. The rows and the counts over them share it (`FBK-4`). */
export const QUEUE_POLL_MS = 5_000;

/**
 * What the instance itself reports: versions, storage, the job counts, the revision (`INT-3e`).
 *
 * **Asked once, and deliberately never on an interval** (`FBK-4`). It walks every file under the
 * storage root to separate the originals from the derivatives, and opens a second engine to read
 * the schema revision. That is the right shape for a page an operator opens and the wrong shape
 * for a ticker; the one number on it that moves while somebody watches has `useQueueCounts`.
 */
export function useSystemStatus(): UseQueryResult<Schemas['SystemStatus']> {
  return useQuery({
    queryKey: keys.systemStatus(),
    queryFn: () => get('/api/admin/status'),
  });
}

/**
 * The queue's tally, at the pace of the rows it sits above (`FBK-4`, `INT-3d`).
 *
 * The counts came off `useSystemStatus` and so were fetched once and never again: the rows below
 * them moved every five seconds while the summary over them stayed at whatever it said when the
 * panel opened. Two numbers describing one table, disagreeing on screen, is worse than either of
 * them being slow.
 */
export function useQueueCounts(): UseQueryResult<Record<string, number>> {
  return useQuery({
    queryKey: keys.jobCounts(),
    queryFn: () => get('/api/admin/jobs/counts'),
    refetchInterval: QUEUE_POLL_MS,
  });
}

/**
 * How many rows the queue draws before it stops being a list and becomes a count (`INT-3d`).
 *
 * **Five, not twenty-five.** The counts above the list already answer the question that brings
 * somebody here -- is anything failed, is anything moving -- and newest-first means the job that
 * just broke is the first row. Everything after the fifth was a finished job from an hour ago
 * pushing the instance's own status two screens down, which is how a healthy queue ended up
 * being the loudest thing on the page.
 *
 * `EXPANDED` is what pressing "Show more" asks for, and it is the old default: enough to work
 * through a bad morning's failures without the panel ever being the whole page by accident.
 */
export const QUEUE_ROWS = { default: 5, expanded: 25 } as const;

export interface Queue {
  jobs: Schemas['JobSummary'][];
  /** How many match, which is not how many are drawn once a bulk import is running. */
  total: number;
  isPending: boolean;
  error: unknown;
}

/**
 * The queue, newest first (`INT-3d`).
 *
 * Newest rather than oldest, because the reason somebody opens this page is that something has
 * just gone wrong -- and the thing that went wrong is at the top.
 *
 * `total` comes from the envelope and counts what matches the filter, not what was returned, so
 * "there are more than this" is a fact rather than a guess from the length of the list. The
 * caller passes `limit`, because how many rows are wanted is a decision the panel makes and
 * changes while somebody is looking at it.
 */
export function useQueue(state: string | undefined, limit: number): Queue {
  const query = useQuery({
    queryKey: keys.jobs({ state, limit }),
    queryFn: () =>
      get('/api/admin/jobs', {
        query: state === undefined ? { limit } : { state, limit },
      }),
    // A queue is the one thing in the product that is moving while somebody watches it.
    refetchInterval: QUEUE_POLL_MS,
    // Asking for more rows should extend the list, not blank it: the rows already on screen
    // are the first rows of the answer being fetched, and flashing a spinner over them would
    // make "show more" look like "start again".
    placeholderData: (previous) => previous,
  });
  return {
    jobs: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isPending: query.isPending,
    error: query.error,
  };
}

export interface JobActions {
  retry: UseMutationResult<unknown, unknown, number>;
  cancel: UseMutationResult<unknown, unknown, number>;
}

export function useJobActions(): JobActions {
  const client = useQueryClient();
  const settle = async () => {
    await invalidate(client, { kind: 'administration' });
  };
  return {
    retry: useMutation({
      mutationFn: (id: number) => post('/api/admin/jobs/{job_id}/retry', { path: { job_id: id } }),
      onSuccess: settle,
    }),
    cancel: useMutation({
      mutationFn: (id: number) => post('/api/admin/jobs/{job_id}/cancel', { path: { job_id: id } }),
      onSuccess: settle,
    }),
  };
}
