/**
 * What V10 reads and writes (`UI-20`, §V10).
 *
 * One module for the account and its sessions, because they are the same subject seen twice --
 * who you are, and where you are signed in -- and because both invalidate the same cached answer
 * the sidebar and the profile menu are already drawing. The sessions half arrives with `UI-20c`.
 *
 * **The theme is deliberately absent.** It is per device and lives in browser storage
 * (`UI-1j`), so it has no request to make and nothing here to invalidate. Language is the
 * opposite: it is a property of the person and it saves against the account, which is the whole
 * reason `UI-20d` ships a select with one option in it.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { patch, post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import type { components } from '@/api/schema';

type Schemas = components['schemas'];
export type UpdateMe = Schemas['UpdateMe'];

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
