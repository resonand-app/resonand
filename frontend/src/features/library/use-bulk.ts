/**
 * The four bulk actions, and what happens when some of them fail (`UI-9b`, `UI-9c`, §V3).
 *
 * Assign a category, add a tag, move, send to trash. Each is one request per recording, and the
 * outcome is a report rather than a success or a failure -- see `bulk.ts` for why that is the
 * design and not a compromise.
 *
 * **Adding a tag is a read followed by a write.** `PATCH /audio/{uuid}` replaces the whole tag
 * list, so "add" means the recording's own tags plus this one -- which is why the action takes the
 * recordings rather than the uuids. Sending only the new tag would silently strip every tag
 * somebody had already put on two hundred recordings, and that is not a mistake with a Ctrl-Z.
 *
 * The cache is invalidated once, at the end, from the change map -- not per recording. Two hundred
 * invalidations of the same key is two hundred refetches of the same list.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { patch, post, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';

import { runBulk } from './bulk';
import type { Outcome } from './bulk';
import type { Recording } from './recordings';

/** Which of the four is running, or has just finished. */
export type BulkKind = 'category' | 'tag' | 'move' | 'trash';

export interface BulkState {
  /** What is running now, and how far through it is. */
  running: { kind: BulkKind; done: number; total: number } | null;
  /** The last run's report, until it is dismissed or another run starts. */
  outcome: (Outcome & { kind: BulkKind }) | null;
}

export interface Bulk extends BulkState {
  assignCategory: (uuids: readonly string[], categoryId: number | null) => Promise<Outcome>;
  addTag: (recordings: readonly Recording[], tag: string) => Promise<Outcome>;
  move: (uuids: readonly string[], libraryUuid: string) => Promise<Outcome>;
  trash: (uuids: readonly string[]) => Promise<Outcome>;
  dismiss: () => void;
}

export function useBulk(libraryUuid: string): Bulk {
  const client = useQueryClient();
  const [state, setState] = useState<BulkState>({ running: null, outcome: null });

  async function run(
    kind: BulkKind,
    uuids: readonly string[],
    action: (uuid: string) => Promise<unknown>,
  ): Promise<Outcome> {
    setState({ running: { kind, done: 0, total: uuids.length }, outcome: null });
    let done = 0;
    const outcome = await runBulk(uuids, async (uuid) => {
      try {
        return await action(uuid);
      } finally {
        done += 1;
        setState((was) =>
          was.running === null ? was : { ...was, running: { ...was.running, done } },
        );
      }
    });

    // Once, at the end. Two hundred invalidations of one key is two hundred refetches of one list.
    if (outcome.succeeded.length > 0) {
      await invalidate(client, { kind: 'library', library: libraryUuid });
    }
    setState({ running: null, outcome: { ...outcome, kind } });
    return outcome;
  }

  return {
    ...state,
    assignCategory: (uuids, categoryId) =>
      run('category', uuids, (uuid) =>
        patch('/api/audio/{audio_uuid}', {
          path: { audio_uuid: uuid },
          // Clearing a category sends `clear_category` rather than a null, because null and
          // "leave it alone" are the same value in JSON (`UI-13c` says the same thing).
          body: categoryId === null ? { clear_category: true } : { category_id: categoryId },
        }),
      ),
    addTag: (recordings, tag) =>
      run(
        'tag',
        recordings.map((one) => one.uuid),
        (uuid) => {
          const recording = recordings.find((one) => one.uuid === uuid);
          const existing = (recording?.tags ?? []).map((one) => one.name);
          if (existing.includes(tag)) return Promise.resolve(undefined);
          return patch('/api/audio/{audio_uuid}', {
            path: { audio_uuid: uuid },
            body: { tags: [...existing, tag] },
          });
        },
      ),
    move: (uuids, destination) =>
      run('move', uuids, (uuid) =>
        post('/api/audio/{audio_uuid}/move', {
          path: { audio_uuid: uuid },
          body: { library_uuid: destination },
        }),
      ),
    trash: (uuids) =>
      run('trash', uuids, (uuid) =>
        remove('/api/audio/{audio_uuid}', { path: { audio_uuid: uuid } }),
      ),
    dismiss: () => {
      setState((was) => ({ ...was, outcome: null }));
    },
  };
}
