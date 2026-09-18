/**
 * What the sidebar knows (`UI-4d`, §2.2).
 *
 * `GET /api/libraries` answers everything readable in one list, and the split into "yours" and
 * "shared with you" is `owner.id` against the signed-in account -- which is why both queries are
 * here rather than in the component: the sidebar is presentational and is handed two arrays.
 *
 * The personal library is always first. It is first because it is where a recording goes when
 * nobody chose, not because it happens to sort that way -- and since `DAT-9` that is all the flag
 * does: what cannot be deleted is an account's last library, whichever one it is.
 */

import { useQuery } from '@tanstack/react-query';

import { get } from '@/api/client';
import { keys } from '@/api/keys';
import type { components } from '@/api/contract/schema';
import { LIBRARY_COLORS } from '@/design-system';
import type { LibraryColorName, SidebarLibrary } from '@/design-system';

import { useSession } from './session';

export type LibrarySummary = components['schemas']['LibrarySummary'];

export interface Libraries {
  own: SidebarLibrary[];
  shared: SidebarLibrary[];
}

/**
 * Every library the caller can read, as the API sends them.
 *
 * `useLibraries` below reduces the same answer to what a sidebar row draws, which loses the level
 * and the uuid's guarantee of being there -- and three views need both: search names the library a
 * result came from, upload has to offer only the ones somebody may write to, and V7 is about one
 * of them. One query key, so none of them costs a second request.
 */
export function useAllLibraries(): LibrarySummary[] {
  const { data } = useQuery({ queryKey: keys.libraries(), queryFn: () => get('/api/libraries') });
  return data ?? [];
}

export function useLibraries(): Libraries {
  const { account } = useSession();
  const { data } = useQuery({ queryKey: keys.libraries(), queryFn: () => get('/api/libraries') });
  const libraries = data ?? [];
  const mine = libraries.filter((one) => one.owner.id === account?.id);
  return {
    own: [...mine].sort(personalFirst).map(asSidebarEntry),
    shared: libraries.filter((one) => one.owner.id !== account?.id).map(asSidebarEntry),
  };
}

/**
 * How many things are in the trash.
 *
 * The count on the sidebar entry. Two endpoints, because a library and a recording are both
 * things somebody put there and both rows they will come looking for -- the same sum
 * `useTrash` shows the view, so the badge and the list it opens cannot disagree.
 *
 * Asked for at `limit: 1`: the sidebar wants the `total` from the envelope and never the rows,
 * and these two queries run on every screen. The entry is there whether or not there is anything
 * in it, and shows no number when there is nothing.
 */
export function useTrashCount(): number {
  const recordings = useQuery({
    queryKey: keys.trashedAudio({ limit: 1 }),
    queryFn: () => get('/api/trash/audio', { query: { limit: 1 } }),
  });
  const libraries = useQuery({
    queryKey: keys.trashedLibraries({ limit: 1 }),
    queryFn: () => get('/api/trash/libraries', { query: { limit: 1 } }),
  });
  return (recordings.data?.total ?? 0) + (libraries.data?.total ?? 0);
}

/**
 * Whether this library may be sent to the trash (`DAT-9`).
 *
 * An account keeps at least one, so the affordance is absent on the last one rather than present
 * and answered with a 400 -- the same reason it used to be absent on the personal library, which
 * is now only the first of them.
 *
 * **A library somebody else owns answers `true`**, because the count this asks about is theirs and
 * this client cannot see it: `GET /api/libraries` returns what the caller can read, not what the
 * owner has. The API asks the question properly and refuses if it is their last, which is rare
 * enough to be worth a refusal rather than a second endpoint.
 */
export function useCanTrashLibrary(
  library: { uuid: string; owner: { id: number } } | undefined,
): boolean {
  const { account } = useSession();
  const libraries = useAllLibraries();
  if (library === undefined || account === undefined) return false;
  if (library.owner.id !== account.id) return true;
  return libraries.filter((one) => one.owner.id === account.id).length > 1;
}

/** The seven colours are names in the API and custom properties in the system. */
export function colourOf(name: string): string {
  return (
    LIBRARY_COLORS.find((one) => one.name === (name as LibraryColorName))?.value ??
    'var(--library-stone)'
  );
}

function asSidebarEntry(library: {
  uuid: string;
  name: string;
  colour: string;
  audio_count: number;
}): SidebarLibrary {
  return {
    id: library.uuid,
    name: library.name,
    colour: colourOf(library.colour),
    count: library.audio_count,
  };
}

function personalFirst(
  left: { is_personal: boolean; name: string },
  right: { is_personal: boolean; name: string },
): number {
  if (left.is_personal !== right.is_personal) return left.is_personal ? -1 : 1;
  return left.name.localeCompare(right.name);
}
