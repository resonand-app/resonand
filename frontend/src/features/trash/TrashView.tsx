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
 * **The retention comes from the instance.** It is an operator's setting (`API-14`), and a number
 * written into the bundle would show 30 days on an instance configured for 7. Until `/instance`
 * has answered, the count is left out rather than guessed -- "0 days left" computed from a number
 * that has not arrived is the one thing this screen must never say.
 */

import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { useInstance } from '@/app/session';
import { Button, PageHeader, RowSkeleton, StateCard } from '@/design-system';

import { TrashRow } from './TrashRow';
import { useTrash, useTrashActions } from './data';

export function TrashView() {
  const { t } = useTranslation('trash');
  const trash = useTrash();
  const actions = useTrashActions();
  const retention = useInstance().data?.trash_retention_days;

  return (
    <section>
      <PageHeader
        title={t('title')}
        meta={retention === undefined ? t('meta') : t('retention', { count: retention })}
      />
      <Contents trash={trash} actions={actions} retention={retention} />
    </section>
  );
}

/** Loading, unreachable, the good empty state, or the list (§3.5, `INT-1d`). */
function Contents({
  trash,
  actions,
  retention,
}: {
  trash: ReturnType<typeof useTrash>;
  actions: ReturnType<typeof useTrashActions>;
  retention: number | undefined;
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
  );
}
