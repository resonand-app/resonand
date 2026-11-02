/**
 * The bulk actions, and what happens when some of them fail (`UI-9b`, `UI-9c`, §V3).
 *
 * Assign a category, add a tag, move, send to trash, and mark or unmark as favourites (`UI-42`).
 * Each is one request per recording, and the outcome is a report rather than a success or a
 * failure -- see `bulk.ts` for why that is the design and not a compromise.
 *
 * **Adding a tag is a read followed by a write.** `PATCH /audio/{uuid}` replaces the whole tag
 * list, so "add" means the recording's own tags plus this one -- which is why the action takes the
 * recordings rather than the uuids. Sending only the new tag would silently strip every tag
 * somebody had already put on two hundred recordings, and that is not a mistake with a Ctrl-Z.
 *
 * The cache is invalidated once, at the end, from the change map -- not per recording. Two hundred
 * invalidations of the same key is two hundred refetches of the same list.
 *
 * **A run reports itself in a toast, raised here where it ends** (`UI-46`, `UI-9c`), so a view
 * holding a bulk bar renders nothing to say what happened. It names what it did -- the category,
 * the tag, the library moved to. Success goes on its own; a trash that moved anything offers
 * *Undo*, which restores through the same kind of run; a partial failure offers *Retry N* on
 * exactly what failed and stays until it is dismissed. What failed is also still selected -- the
 * view's `onOutcome` sees every run, retries and undos included -- so the toast is never the only
 * place a failure exists. Each run's toast replaces the last one's, and a failure's goes as soon
 * as the next run starts: its *Retry* would act on a selection that has since moved on.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { patch, post, put, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { useAllLibraries } from '@/app/library-data';
import { raiseToast, useToasts } from '@/app/toasts';

import { reasonsIn, runBulk } from './bulk';
import type { Outcome } from './bulk';
import type { Category, Recording } from './recordings';

/** Which one is running, or the restore that undoes a trash. */
export type BulkKind =
  'category' | 'tag' | 'move' | 'trash' | 'favourite' | 'unfavourite' | 'restore';

/**
 * How a run is reported: which pair of sentences in `bulk.done` and `bulk.partial`, and the name
 * they carry. Not always the kind -- clearing a category and a move whose destination has no name
 * yet read differently from assigning one and moving somewhere named.
 */
interface Said {
  words: string;
  name?: string;
}

export interface BulkState {
  /** What is running now, and how far through it is. */
  running: { kind: BulkKind; done: number; total: number } | null;
}

export interface Bulk extends BulkState {
  assignCategory: (
    uuids: readonly string[],
    category: Pick<Category, 'id' | 'name'> | null,
  ) => Promise<Outcome>;
  addTag: (recordings: readonly Recording[], tag: string) => Promise<Outcome>;
  move: (uuids: readonly string[], libraryUuid: string) => Promise<Outcome>;
  trash: (uuids: readonly string[]) => Promise<Outcome>;
  /** Mark every one of them, or take every mark off. */
  favourite: (uuids: readonly string[], on: boolean) => Promise<Outcome>;
}

/**
 * For one library, or for a selection that spans several (the favourites view), with none.
 *
 * @param onOutcome Every run's result, retries and undos included -- the view keeps what failed
 *   selected from it.
 */
export function useBulk(libraryUuid?: string, onOutcome?: (outcome: Outcome) => void): Bulk {
  const { t } = useTranslation('library');
  const client = useQueryClient();
  const libraries = useAllLibraries();
  const [state, setState] = useState<BulkState>({ running: null });
  const report = useRef(onOutcome);
  /** The last failure's toast, whose *Retry* the next run makes stale. */
  const retrying = useRef<string | null>(null);

  useEffect(() => {
    report.current = onOutcome;
  });

  function say(kind: BulkKind, said: Said, outcome: Outcome, again: (uuids: string[]) => void) {
    const failed = outcome.failed.length;
    const done = outcome.succeeded.length;
    const name = said.name === undefined ? {} : { name: said.name };
    if (failed === 0) {
      raiseToast({
        tone: 'done',
        message: t(`bulk.done.${said.words}`, { count: done, ...name }),
        ...(kind === 'trash'
          ? {
              action: {
                label: t('common:action.undo'),
                run: () => {
                  void restore(outcome.succeeded);
                },
              },
            }
          : {}),
      });
      return;
    }
    const failures = outcome.failed.map((one) => one.uuid);
    retrying.current = raiseToast({
      tone: 'failed',
      message: [
        t(`bulk.partial.${said.words}`, { done, count: failed, ...name }),
        ...reasonsIn(outcome.failed).map((reason) =>
          t('bulk.reason', { count: reason.count, detail: reason.detail }),
        ),
        ...(kind === 'restore' ? [] : [t('bulk.stillSelected', { count: failed })]),
      ].join(' '),
      action: {
        label: t('bulk.retry', { count: failed }),
        run: () => {
          again(failures);
        },
      },
    });
  }

  async function run(
    kind: BulkKind,
    uuids: readonly string[],
    action: (uuid: string) => Promise<unknown>,
    said: Said = { words: kind },
  ): Promise<Outcome> {
    if (retrying.current !== null) useToasts.getState().dismiss(retrying.current);
    retrying.current = null;
    setState({ running: { kind, done: 0, total: uuids.length } });
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
      await invalidate(client, {
        kind: 'library',
        ...(libraryUuid === undefined ? {} : { library: libraryUuid }),
      });
    }
    setState({ running: null });
    report.current?.(outcome);
    say(kind, said, outcome, (failures) => {
      void run(kind, failures, action, said);
    });
    return outcome;
  }

  function restore(uuids: readonly string[]) {
    return run('restore', uuids, (uuid) =>
      post('/api/audio/{audio_uuid}/restore', { path: { audio_uuid: uuid } }),
    );
  }

  return {
    ...state,
    assignCategory: (uuids, category) =>
      run(
        'category',
        uuids,
        (uuid) =>
          patch('/api/audio/{audio_uuid}', {
            path: { audio_uuid: uuid },
            // Clearing a category sends `clear_category` rather than a null, because null and
            // "leave it alone" are the same value in JSON (`UI-13c` says the same thing).
            body: category === null ? { clear_category: true } : { category_id: category.id },
          }),
        category === null ? { words: 'uncategorised' } : { words: 'category', name: category.name },
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
        { words: 'tag', name: tag },
      ),
    move: (uuids, destination) => {
      const name = libraries.find((one) => one.uuid === destination)?.name;
      return run(
        'move',
        uuids,
        (uuid) =>
          post('/api/audio/{audio_uuid}/move', {
            path: { audio_uuid: uuid },
            body: { library_uuid: destination },
          }),
        name === undefined ? { words: 'moveAway' } : { words: 'move', name },
      );
    },
    trash: (uuids) =>
      run('trash', uuids, (uuid) =>
        remove('/api/audio/{audio_uuid}', { path: { audio_uuid: uuid } }),
      ),
    favourite: (uuids, on) =>
      run(on ? 'favourite' : 'unfavourite', uuids, (uuid) =>
        on
          ? put('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: uuid } })
          : remove('/api/audio/{audio_uuid}/favourite', { path: { audio_uuid: uuid } }),
      ),
  };
}
