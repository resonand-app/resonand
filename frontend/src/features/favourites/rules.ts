/**
 * What a selection of favourites may have done to it (`UI-44`).
 *
 * A favourites selection spans libraries and levels, so each action is drawn only when **every**
 * recording selected allows it -- one recording somebody only reads takes Tag away from the rest
 * until it is deselected, rather than offering an action that would fail on part of the
 * selection. Absent, never disabled (§3.5).
 *
 * Unmarking needs nothing, because the mark is the caller's own. A category and a move also need
 * the whole selection in one library the caller can read: a category belongs to one library, and
 * the move dialog names who gains and loses access against the library the recordings leave.
 */

import { LEVEL } from '@/features/library/data';
import type { Recording } from '@/features/library/recordings';

export interface SelectionRules {
  /** A tag, and a category where `library` is set. */
  canEdit: boolean;
  canMove: boolean;
  canTrash: boolean;
  /** The one readable library everything selected sits in, when there is one. */
  library: string | undefined;
}

export function rulesFor(
  selected: readonly Recording[],
  readable: ReadonlySet<string>,
): SelectionRules {
  const every = (level: number) =>
    selected.length > 0 && selected.every((one) => one.level >= level);
  const libraries = new Set(selected.map((one) => one.library_uuid));
  const only = libraries.size === 1 ? [...libraries][0] : undefined;
  const library = only !== undefined && readable.has(only) ? only : undefined;
  return {
    canEdit: every(LEVEL.edit),
    canMove: every(LEVEL.manage) && library !== undefined,
    canTrash: every(LEVEL.manage),
    library,
  };
}
