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
  revoke: UseMutationResult<unknown, unknown, number>;
}

/** Granting, changing a level and revoking. All three need level 30. */
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
 * One person, by their full address (`UI-17d`, `API-15`).
 *
 * Deliberately not a search. It matches the whole normalised email and returns at most one
 * account, because a prefix or a name search would let any library manager enumerate the
 * instance -- the same class of leak the ACL-filtered tag autocomplete exists to prevent.
 * Sharing needs to confirm one address somebody was given out of band; it does not need a
 * directory, and the interface must not look like one.
 */
export function useLookup(email: string): { person: UserSummary | undefined; isPending: boolean } {
  const asked = email.trim();
  const query = useQuery({
    queryKey: ['users', 'lookup', asked.toLowerCase()],
    queryFn: () => get('/api/users/lookup', { query: { email: asked } }),
    // Nothing is asked until there is a whole address to ask about: a request per keystroke would
    // be a request per keystroke about somebody's colleagues.
    enabled: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(asked),
    staleTime: 60_000,
  });
  return { person: query.data?.[0], isPending: query.isFetching };
}
