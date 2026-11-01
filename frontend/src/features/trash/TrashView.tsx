/**
 * V9 · Trash (`INT-1a`, `INT-1d`, §V9).
 *
 * **Its job is to make deletion recoverable and permanent deletion deliberate**, which is the
 * whole of principle 5 in one screen. Everything here follows from those two halves.
 *
 * **One list with a type marker, not two sections.** The question somebody arrives with is where
 * a thing went, not whether it was a library, and a screen that made them pick a section first
 * would be answering a question nobody asked. The type is a marker on the row instead.
 *
 * **Closest to being purged first.** Both endpoints already answer in that order, so the merge
 * preserves it rather than sorting by name or by kind: the thing that needs a decision soonest is
 * the thing at the top.
 *
 * **The empty state is the good state.** A trash with nothing in it means nothing is waiting to be
 * destroyed, and it should read as reassurance rather than as absence -- so it says what the trash
 * is for and how long things stay, and offers no action, because there is nothing to do.
 *
 * **Any part of it can be destroyed at once, and so can all of it** (`INT-8`). Rows are ticked
 * as a library's are, and a selection replaces the bar above the list with the bulk bar, at the
 * same height so nothing moves under the pointer; its one action is *Delete permanently*. *Empty
 * trash* sits in the header whenever there is anything to empty. Both raise the same dialog,
 * which counts what goes before anything does. Restore stays one call per item (`INT-1c`).
 *
 * **The retention comes from the instance.** It is an operator's setting (`API-14`), and a number
 * written into the bundle would show 30 days on an instance configured for 7. Until `/instance`
 * has answered, the count is left out rather than guessed -- "0 days left" computed from a number
 * that has not arrived is the one thing this screen must never say.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { useInstance } from '@/app/session';
import { useKeyboard } from '@/app/use-keyboard';
import { BulkBar } from '@/components/BulkBar';
import { FilterBar } from '@/components/FilterBar';
import { Button, PageHeader, RowSkeleton, StateCard } from '@/design-system';

import { BulkPurgeDialog } from './BulkPurgeDialog';
import { TrashRow } from './TrashRow';
import { useTrash, useTrashActions } from './data';
import { NOTHING, coverage, doomed, everything, present, toggle } from './selection';
import type { Selected } from './selection';

export function TrashView() {
  const { t } = useTranslation('trash');
  const trash = useTrash();
  const actions = useTrashActions();
  const retention = useInstance().data?.trash_retention_days;
  const [ticked, setTicked] = useState<Selected>(NOTHING);
  const [purging, setPurging] = useState<'selection' | 'everything' | null>(null);
  // What was ticked and has since left the trash -- restored, or gone in another tab -- is no
  // longer selected, so the count and the dialog only ever describe rows still on screen.
  const selected = present(ticked, trash.entries);
  const going = doomed(selected, trash.entries);

  useKeyboard(
    selected.size > 0
      ? {
          dismiss: () => {
            setTicked(NOTHING);
          },
        }
      : {},
  );

  return (
    <section>
      <PageHeader
        title={t('title')}
        meta={retention === undefined ? t('meta') : t('retention', { count: retention })}
        {...(trash.entries.length > 0 && {
          actions: (
            <Button
              variant="danger"
              onClick={() => {
                setPurging('everything');
              }}
            >
              {t('emptyTrash')}
            </Button>
          ),
        })}
      />
      <Contents
        trash={trash}
        actions={actions}
        retention={retention}
        bar={
          selected.size > 0 ? (
            <BulkBar
              count={going.libraries.length + going.recordings.length}
              allSelected={coverage(selected, trash.entries)}
              onSelectAll={(on) => {
                setTicked(on ? everything(trash.entries) : NOTHING);
              }}
              onClear={() => {
                setTicked(NOTHING);
              }}
              actions={
                <Button
                  variant="danger"
                  onClick={() => {
                    setPurging('selection');
                  }}
                >
                  {t('bulk.action')}
                </Button>
              }
            />
          ) : (
            <FilterBar
              filters={
                <Button
                  variant="ghost"
                  onClick={() => {
                    setTicked(everything(trash.entries));
                  }}
                >
                  {t('common:selection.selectAll')}
                </Button>
              }
              meta={t('held', { count: trash.total })}
            />
          )
        }
        selection={{
          selected,
          onToggle: (uuid) => {
            setTicked((was) => toggle(present(was, trash.entries), uuid));
          },
        }}
      />
      <BulkPurgeDialog
        open={purging !== null}
        {...(purging === 'selection' && { selection: going })}
        onClose={() => {
          setPurging(null);
        }}
        onSettled={() => {
          setTicked(NOTHING);
        }}
      />
    </section>
  );
}

/** Loading, unreachable, the good empty state, or the list (§3.5, `INT-1d`). */
function Contents({
  trash,
  actions,
  retention,
  bar,
  selection,
}: {
  trash: ReturnType<typeof useTrash>;
  actions: ReturnType<typeof useTrashActions>;
  retention: number | undefined;
  /** The bar above the list, or the bulk bar that replaces it. Drawn only over a list. */
  bar: React.ReactNode;
  selection: { selected: Selected; onToggle: (uuid: string) => void };
}) {
  const { t } = useTranslation('trash');
  const { t: common } = useTranslation();

  if (trash.isPending) {
    return (
      <div aria-hidden>
        {Array.from({ length: 6 }, (_, index) => (
          <RowSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (trash.error !== null && trash.error !== undefined) {
    return (
      <StateCard
        icon="alert-circle"
        title={t('error.title')}
        body={isApiProblem(trash.error) ? trash.error.detail : common('state.offline')}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              trash.refetch();
            }}
          >
            {common('action.retry')}
          </Button>
        }
      />
    );
  }

  if (trash.entries.length === 0) {
    /* Reassurance and not absence: nothing is waiting to be destroyed, which is the state
       somebody wants to be in. No action, because there is nothing here to do. */
    return (
      <StateCard
        icon="trash-2"
        title={t('empty.title')}
        body={retention === undefined ? undefined : t('empty.body', { count: retention })}
      />
    );
  }

  return (
    <>
      {bar}
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {trash.entries.map((entry) => (
          <TrashRow
            key={entry.kind === 'library' ? entry.library.uuid : entry.recording.uuid}
            entry={entry}
            retention={retention}
            actions={actions}
            selection={selection}
          />
        ))}
        {trash.hasMore && (
          <li
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {t('partial', { count: trash.entries.length })}
          </li>
        )}
      </ul>
    </>
  );
}
