/**
 * What the landing page knows (`UI-31a`, §V2).
 *
 * `GET /api/libraries` answers every library the caller can read in one list, and the landing
 * page is that list split on `owner.id` against the signed-in account -- the same split the
 * sidebar makes, from the same query key, so the two cannot disagree about who owns what while
 * both are on screen.
 *
 * It is deliberately not `app/library-data.ts`. That module reduces a library to the four fields
 * a sidebar row draws; the landing page needs the summary as the API sends it -- the colour, the
 * level, the owner, both counts -- and a second reducer over the same data would be the thing
 * that eventually shows a different recording count in two places on one screen.
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';
import { useSession } from '@/app/session';

export type LibrarySummary = components['schemas']['LibrarySummary'];

export interface LibraryList {
  /** The ones this account owns, the personal library first. */
  own: LibrarySummary[];
  /** The ones somebody else owns and shared. Empty is a real answer: the group is then absent. */
  shared: LibrarySummary[];
  /** How many recordings there are altogether, across both groups. */
  recordings: number;
  /** How long they run altogether, in milliseconds. */
  durationMs: number;
  isPending: boolean;
  error: unknown;
  refetch: () => void;
}

export function useLibraryList(): LibraryList {
  const { account } = useSession();
  const query = useQuery({
    queryKey: keys.libraries(),
    queryFn: () => get('/api/libraries'),
  });
  const libraries = query.data ?? [];
  const own = libraries.filter((one) => one.owner.id === account?.id).sort(personalFirst);
  const shared = libraries.filter((one) => one.owner.id !== account?.id);

  return {
    own,
    shared,
    // The shape of the archive is everything in it, including what somebody else shared: it is
    // what this account can listen to, which is the question the number on the home page answers.
    recordings: libraries.reduce((sum, one) => sum + one.audio_count, 0),
    durationMs: libraries.reduce((sum, one) => sum + one.total_duration_ms, 0),
    isPending: query.isPending,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * The personal library first, then by name.
 *
 * First because it is where a recording goes when nobody chose, not because it happens to sort
 * that way -- and `localeCompare` for the rest, because an archive with `Field recordings` in it
 * sorts wrongly under a byte comparison.
 */
function personalFirst(left: LibrarySummary, right: LibrarySummary): number {
  if (left.is_personal !== right.is_personal) return left.is_personal ? -1 : 1;
  return left.name.localeCompare(right.name);
}
