/**
 * What V10 reads and writes (`UI-20`, §V10).
 *
 * One module for the account and its sessions, because they are the same subject seen twice --
 * who you are, and where you are signed in -- and because both invalidate the same cached answer
 * the sidebar and the profile menu are already drawing.
 *
 * **The theme is deliberately absent.** It is per device and lives in browser storage
 * (`UI-1j`), so it has no request to make and nothing here to invalidate. Language is the
 * opposite: it is a property of the person and it saves against the account, which is the whole
 * reason `UI-20d` ships a select with one option in it.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import { get, patch, post, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import type { components } from '@/api/schema';

type Schemas = components['schemas'];
export type UpdateMe = Schemas['UpdateMe'];
export type SessionSummary = Schemas['SessionSummary'];

/** Display name, address and language. Never the password, which is a different operation. */
export function useUpdateAccount(): UseMutationResult<unknown, unknown, UpdateMe> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMe) => patch('/api/auth/me', { body }),
    onSuccess: async () => {
      await invalidate(client, { kind: 'account' });
    },
  });
}

export interface PasswordChange {
  current_password: string;
  new_password: string;
}

/**
 * A new password, which needs the current one.
 *
 * Nothing is invalidated. The endpoint ends every other session rather than this one, so what
 * changes is a list this view may not even be showing -- and the sessions panel refetches on its
 * own when somebody opens it. Invalidating the account here would refetch a name that did not
 * change.
 */
export function useChangePassword(): UseMutationResult<unknown, unknown, PasswordChange> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PasswordChange) => post('/api/auth/password', { body }),
    onSuccess: async () => {
      await invalidate(client, { kind: 'session' });
    },
  });
}

/** Every sign-in this account has (`UI-20c`). */
export function useSessions(): UseQueryResult<SessionSummary[]> {
  return useQuery({
    queryKey: keys.sessions(),
    queryFn: () => get('/api/auth/sessions'),
    // A device somebody has just noticed is a device they want gone now, so this is the one list
    // in the product that is stale the moment it is drawn.
    staleTime: 0,
  });
}

export interface SessionRevocations {
  one: UseMutationResult<unknown, unknown, number>;
  others: UseMutationResult<unknown, unknown, void>;
}

/**
 * Revoking one sign-in, and revoking every other one.
 *
 * Two mutations rather than one with a flag, because the API has two endpoints and they answer
 * different questions: "not that device" and "none of them but this one". A single call taking a
 * list would make the second one a loop over sessions the interface had to enumerate first --
 * and the list it enumerated could already be out of date.
 */
export function useSessionRevocations(): SessionRevocations {
  const client = useQueryClient();
  const settle = async () => {
    await invalidate(client, { kind: 'session' });
  };
  return {
    one: useMutation({
      mutationFn: (id: number) =>
        remove('/api/auth/sessions/{session_id}', { path: { session_id: id } }),
      onSuccess: settle,
    }),
    others: useMutation({
      mutationFn: () => remove('/api/auth/sessions'),
      onSuccess: settle,
    }),
  };
}
