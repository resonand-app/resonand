/**
 * What the sidebar knows (`UI-4d`, §2.2).
 *
 * `GET /api/libraries` answers everything readable in one list, and the split into "yours" and
 * "shared with you" is `owner.id` against the signed-in account -- which is why both queries are
 * here rather than in the component: the sidebar is presentational and is handed two arrays.
 *
 * The personal library is always first and cannot be deleted. It is first because it is where a
 * recording goes when nobody chose, not because it happens to sort that way.
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
 * How many recordings are in the trash.
 *
 * The count on the sidebar entry, from `GET /api/trash/audio`'s `total` -- the entry is there
 * whether or not there is anything in it, and shows no number when there is nothing.
 */
export function useTrashCount(): number {
  const { data } = useQuery({
    queryKey: keys.trashedAudio({ limit: 1 }),
    queryFn: () => get('/api/trash/audio', { query: { limit: 1 } }),
  });
  return data?.total ?? 0;
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
