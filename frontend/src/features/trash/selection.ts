/**
 * What a selection in the trash destroys (`INT-8`).
 *
 * **A set of uuids, as a library's selection is**, because uuids are unique across recordings and
 * libraries and a selection has to survive the list being refetched under it. What is selected
 * and what goes are not the same thing, and this module is the difference.
 *
 * **A library takes what it groups.** Selecting a trashed library selects every recording the
 * trash shows under it, and the recordings still live inside it that the trash does not show at
 * all -- which is what `API-28` destroys, and so what the confirmation has to count. A recording
 * reached both ways is one recording: counted once, and sent once.
 */

import type { components } from '@/api/contract/schema';

import type { TrashEntry, TrashedLibrary, TrashedRecording } from './data';

export type Selected = ReadonlySet<string>;

export const NOTHING: Selected = new Set();

/** What would go, with the count a confirmation states and the body the purge is sent. */
export interface Doomed {
  libraries: TrashedLibrary[];
  /** Recordings selected on their own, outside any selected library. */
  recordings: TrashedRecording[];
  tally: { recordings: number; libraries: number };
  body: components['schemas']['PurgeSelection'];
}

/** Every uuid a row can be ticked for, in the order on screen. */
export function selectable(entries: readonly TrashEntry[]): string[] {
  return entries.flatMap((entry) =>
    entry.kind === 'recording'
      ? [entry.recording.uuid]
      : [entry.library.uuid, ...entry.children.map((child) => child.uuid)],
  );
}

/** Turn one on or off. */
export function toggle(selected: Selected, uuid: string): Selected {
  const next = new Set(selected);
  if (next.has(uuid)) next.delete(uuid);
  else next.add(uuid);
  return next;
}

/** Whether everything on screen is selected, some of it, or none. The bulk bar's checkbox. */
export function coverage(selected: Selected, entries: readonly TrashEntry[]): boolean | 'mixed' {
  const tops = entries.map((entry) =>
    entry.kind === 'recording' ? entry.recording.uuid : entry.library.uuid,
  );
  if (tops.length > 0 && tops.every((uuid) => selected.has(uuid))) return true;
  return selected.size > 0 ? 'mixed' : false;
}

/** Every row at the top level: a library carries what it groups, so its children need not be. */
export function everything(entries: readonly TrashEntry[]): Selected {
  return new Set(
    entries.map((entry) =>
      entry.kind === 'recording' ? entry.recording.uuid : entry.library.uuid,
    ),
  );
}

/** Keep only what is still in the trash, so a selection does not outlive the rows it named. */
export function present(selected: Selected, entries: readonly TrashEntry[]): Selected {
  const there = new Set(selectable(entries));
  const kept = [...selected].filter((uuid) => there.has(uuid));
  return kept.length === selected.size ? selected : new Set(kept);
}

/** What the selection destroys, counted the way `API-28` counts it. */
export function doomed(selected: Selected, entries: readonly TrashEntry[]): Doomed {
  const libraries: TrashedLibrary[] = [];
  const recordings: TrashedRecording[] = [];
  const grouped: TrashedRecording[] = [];
  for (const entry of entries) {
    if (entry.kind === 'recording') {
      if (selected.has(entry.recording.uuid)) recordings.push(entry.recording);
    } else if (selected.has(entry.library.uuid)) {
      libraries.push(entry.library);
      grouped.push(...entry.children);
    } else {
      recordings.push(...entry.children.filter((child) => selected.has(child.uuid)));
    }
  }
  // `audio_count` leaves out what was trashed on its own, which the trash shows as children.
  const live = libraries.reduce((sum, one) => sum + one.audio_count, 0);
  return {
    libraries,
    recordings,
    tally: {
      recordings: live + recordings.length + grouped.length,
      libraries: libraries.length,
    },
    body: {
      library_uuids: libraries.map((one) => one.uuid),
      audio_uuids: recordings.map((one) => one.uuid),
    },
  };
}
