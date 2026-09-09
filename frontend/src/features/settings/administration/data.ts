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
import type { components } from '@/api/schema';

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
  };
}
