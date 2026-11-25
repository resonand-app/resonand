/**
 * What V7 changes, and what each change makes stale (`UI-17`, §V7).
 *
 * One module for the three things this view writes -- the library itself, its categories and its
 * shares -- because they share an invalidation story and a permission: everything here needs level
 * 30, and everything here changes something the sidebar or a grid is already drawing.
 *
 * **Recolouring reaches the sidebar straight away** (`UI-17a`), which is not a nicety: the colour
 * is how somebody finds the library in a list of seven, and a swatch that took a reload to take
 * effect would make the picker feel like it had not worked. `invalidate` already knows that a
 * library change reaches `keys.libraries()`.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';

import { get, patch, post, put, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { keys } from '@/api/keys';
import { HANDLED_INVALID } from '@/api/query-client';
import type { components } from '@/api/contract/schema';

type Schemas = components['schemas'];
export type UpdateLibrary = Schemas['UpdateLibrary'];
export type Category = Schemas['CategorySummary'];
export type ShareSummary = Schemas['ShareSummary'];
export type UserSummary = Schemas['UserSummary'];
/** The four the API defines, as a type rather than as any number (`DEC-14`). */
export type Level = Schemas['Level'];

/** Rename, recolour, or describe. */
export function useUpdateLibrary(uuid: string): UseMutationResult<unknown, unknown, UpdateLibrary> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateLibrary) =>
      patch('/api/libraries/{library_uuid}', { path: { library_uuid: uuid }, body }),
    // A name over the limit is drawn under the name field, not in a toast.
    meta: HANDLED_INVALID,
    onSuccess: async () => {
      await invalidate(client, { kind: 'library', library: uuid });
    },
  });
}

/** Send the whole library to the trash, with everything in it. */
export function useTrashLibrary(uuid: string): UseMutationResult<unknown, unknown, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => remove('/api/libraries/{library_uuid}', { path: { library_uuid: uuid } }),
    onSuccess: async () => {
      await invalidate(client, { kind: 'library', library: uuid });
    },
  });
}

export interface CategoryEdits {
  create: UseMutationResult<Category, unknown, { name: string; parentId: number | null }>;
  rename: UseMutationResult<unknown, unknown, { id: number; name: string }>;
  reparent: UseMutationResult<unknown, unknown, { id: number; parentId: number | null }>;
  reorder: UseMutationResult<unknown, unknown, number[]>;
  destroy: UseMutationResult<unknown, unknown, number>;
}

/**
 * Everything the category tree can be told to do.
 *
 * Five mutations rather than one, because the API has five endpoints and collapsing them into a
 * "save the tree" call would mean the interface deciding what changed -- which is how a reorder
 * silently becomes a re-parent.
 */
export function useCategoryEdits(uuid: string): CategoryEdits {
  const client = useQueryClient();
  const path = { library_uuid: uuid };
  const settle = async () => {
    await client.invalidateQueries({ queryKey: keys.libraryCategories(uuid) });
    // A category is drawn on every card and row in the library, so its list is stale too.
    await invalidate(client, { kind: 'library', library: uuid });
  };

  return {
    create: useMutation({
      mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) =>
        post('/api/libraries/{library_uuid}/categories', {
          path,
          body: { name, parent_id: parentId },
        }),
      onSuccess: settle,
    }),
    rename: useMutation({
      mutationFn: ({ id, name }: { id: number; name: string }) =>
        patch('/api/libraries/{library_uuid}/categories/{category_id}', {
          path: { ...path, category_id: id },
          body: { name },
        }),
      onSuccess: settle,
    }),
    reparent: useMutation({
      mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) =>
        patch('/api/libraries/{library_uuid}/categories/{category_id}', {
          path: { ...path, category_id: id },
          // A null parent is the root, and the endpoint reads a null as "leave it alone" -- so
          // moving a category up to the root is `clear_parent`, exactly as clearing a recording's
          // category is (`UI-13c`).
          body: parentId === null ? { clear_parent: true } : { parent_id: parentId },
        }),
      onSuccess: settle,
    }),
    reorder: useMutation({
      mutationFn: (orderedIds: number[]) =>
        post('/api/libraries/{library_uuid}/categories/order', {
          path,
          body: { ordered_ids: orderedIds },
        }),
      onSuccess: settle,
    }),
    destroy: useMutation({
      mutationFn: (id: number) =>
        remove('/api/libraries/{library_uuid}/categories/{category_id}', {
          path: { ...path, category_id: id },
        }),
      onSuccess: settle,
    }),
  };
}

export interface ShareEdits {
  grant: UseMutationResult<ShareSummary, unknown, { granteeId: number; level: Level }>;
  /** Several people at one level: one grant each, sent together, and one refresh after them. */
  grantMany: UseMutationResult<unknown, unknown, { granteeIds: readonly number[]; level: Level }>;
  revoke: UseMutationResult<unknown, unknown, number>;
}

/** Granting, changing a level and revoking. All of them need level 30. */
export function useShareEdits(uuid: string): ShareEdits {
  const client = useQueryClient();
  const settle = async () => {
    await invalidate(client, { kind: 'share', library: uuid });
  };

  return {
    grant: useMutation({
      mutationFn: ({ granteeId, level }: { granteeId: number; level: Level }) =>
        put('/api/libraries/{library_uuid}/shares', {
          path: { library_uuid: uuid },
          body: { grantee_id: granteeId, level },
        }),
      onSuccess: settle,
    }),
    grantMany: useMutation({
      // Every grant is sent whatever the others do, and the first refusal is what the toast
      // says. Who did get access is the shares' answer, refreshed once they have all settled.
      mutationFn: async ({
        granteeIds,
        level,
      }: {
        granteeIds: readonly number[];
        level: Level;
      }) => {
        const results = await Promise.allSettled(
          granteeIds.map((granteeId) =>
            put('/api/libraries/{library_uuid}/shares', {
              path: { library_uuid: uuid },
              body: { grantee_id: granteeId, level },
            }),
          ),
        );
        const refused = results.find(
          (one): one is PromiseRejectedResult => one.status === 'rejected',
        );
        if (refused !== undefined) throw refused.reason;
        return results;
      },
      onSettled: settle,
    }),
    revoke: useMutation({
      mutationFn: (granteeId: number) =>
        remove('/api/libraries/{library_uuid}/shares/{grantee_id}', {
          path: { library_uuid: uuid, grantee_id: granteeId },
        }),
      onSuccess: settle,
    }),
  };
}

/**
 * Everybody a library can be shared with (`UI-49`, `DEC-29`).
 *
 * Every active account on the instance but the caller's, by name. `DEC-29` chose a list over a
 * full address typed from memory, and accepted that it shows any library manager who else has
 * an account here. Who already has access is the panel's to leave out, not the endpoint's.
 */
export function usePeopleToShareWith(): {
  people: readonly UserSummary[];
  isPending: boolean;
  isError: boolean;
} {
  const query = useQuery({
    queryKey: ['users', 'shareable'],
    queryFn: () => get('/api/users'),
    staleTime: 60_000,
  });
  return { people: query.data ?? [], isPending: query.isPending, isError: query.isError };
}
