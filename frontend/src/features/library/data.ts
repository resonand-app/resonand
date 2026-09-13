/**
 * What a library view knows about the library it is showing (`UI-6a`, §V3).
 *
 * Two requests, and the second one is the reason this is a module rather than two `useQuery`
 * calls in a component: the header, the filter bar and the bulk bar all ask the same question --
 * may this person change anything here -- and the answer has to come from one place. A view that
 * decided it twice would eventually offer a control that the API refuses.
 *
 * `level` is the API's own number (`DEC-14`'s 10/20/30/40), read off the library rather than
 * inferred from ownership: a library you own and one shared with you at manage differ in what
 * they say, not in what you may do.
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';
import { useSession } from '@/app/session';

export type LibrarySummary = components['schemas']['LibrarySummary'];
export type ShareSummary = components['schemas']['ShareSummary'];

/** What somebody may do here. The API's levels, named (`sonarium.core.levels`). */
export const LEVEL = { read: 10, edit: 20, manage: 30, owner: 40 } as const;

export interface LibraryContext {
  library: LibrarySummary | undefined;
  /** Who else has access, for the avatar stack. Readable by anybody who can read the library. */
  shares: ShareSummary[];
  /** Whether the library belongs to the signed-in account. */
  isOwn: boolean;
  /** Level 20 or above: titles, notes, categories, tags, uploads, the trash. */
  canEdit: boolean;
  /** Level 30 or above: the settings view, and sharing it onwards. */
  canManage: boolean;
  /** Level 10 exactly. The screen says so once, quietly, and drops what it cannot offer. */
  isReadOnly: boolean;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

export function useLibrary(uuid: string): LibraryContext {
  const { account } = useSession();
  const library = useQuery({
    queryKey: keys.library(uuid),
    queryFn: () => get('/api/libraries/{library_uuid}', { path: { library_uuid: uuid } }),
    enabled: uuid !== '',
  });
  const shares = useQuery({
    queryKey: keys.libraryShares(uuid),
    queryFn: () => get('/api/libraries/{library_uuid}/shares', { path: { library_uuid: uuid } }),
    enabled: uuid !== '' && library.data !== undefined,
  });

  const level = library.data?.level ?? LEVEL.read;

  return {
    library: library.data,
    shares: shares.data ?? [],
    isOwn: library.data?.owner.id === account?.id,
    canEdit: level >= LEVEL.edit,
    canManage: level >= LEVEL.manage,
    isReadOnly: library.data !== undefined && level < LEVEL.edit,
    isPending: library.isPending,
    error: library.error,
    refetch: () => {
      void library.refetch();
    },
  };
}
