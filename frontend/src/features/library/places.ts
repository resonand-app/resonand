/**
 * Where each recording on a list lives: its library's name, and its category's (`UI-43`).
 *
 * In one library both are that library's, which the view has already fetched. Across libraries
 * each row carries its own, resolved against the libraries the caller can read and the category
 * tree of each one on screen -- fetched once per library, under the key the library view already
 * caches it by, so a list of favourites from libraries somebody has opened costs nothing more.
 *
 * **A row whose library is not among them names neither.** A recording shared on its own does not
 * grant its library (`library_acl` ignores individual grants on purpose), so its library is not in
 * the list and its tree would be refused. No name is better than a wrong one, and the player says
 * nothing under the title for it either.
 */

import { useQueries } from '@tanstack/react-query';

import { useAllLibraries } from '@/app/library-data';

import { categoriesQuery } from './recordings';
import type { Categories, Recording } from './recordings';

export interface Places {
  /** The library's name, or `undefined` where the caller cannot read the library. */
  libraryOf: (recording: Recording) => string | undefined;
  categoryOf: (recording: Recording) => string | undefined;
  /** Whether the rows come from more than one library, which is when a row says which. */
  spansLibraries: boolean;
}

/** One library's rows, named from what the library view already holds. */
export function oneLibrary(name: string, categories: Categories): Places {
  return {
    libraryOf: () => name,
    categoryOf: (recording) => categories.nameOf(recording.category_id),
    spansLibraries: false,
  };
}

/** Rows from anywhere, each named against its own library. Pass none to fetch nothing. */
export function usePlaces(recordings: readonly (Recording | undefined)[]): Places {
  const libraries = useAllLibraries();
  const readable = new Map(libraries.map((one) => [one.uuid, one.name]));
  const shown = [
    ...new Set(
      recordings.flatMap((one) =>
        one !== undefined && readable.has(one.library_uuid) ? [one.library_uuid] : [],
      ),
    ),
  ].sort();
  const trees = useQueries({ queries: shown.map((uuid) => categoriesQuery(uuid)) });
  const named = new Map(
    shown.map((uuid, index) => [
      uuid,
      new Map((trees[index]?.data ?? []).map((category) => [category.id, category.name])),
    ]),
  );
  return {
    libraryOf: (recording) => readable.get(recording.library_uuid),
    categoryOf: (recording) =>
      recording.category_id === null
        ? undefined
        : named.get(recording.library_uuid)?.get(recording.category_id),
    spansLibraries: true,
  };
}
