/**
 * Destroying part of the trash, or all of it, with one confirmation (`INT-8`, `DEC-28`).
 *
 * **One dialog for both**, because they are one consequence, and it says it the way deleting one
 * row does: a title that counts what goes, drawn apart from the question around it as a name is,
 * *permanently* in the title and on the button, nothing underneath, and the focus on Cancel. What
 * differs is where the count comes from. A selection is counted from the rows it ticked; the
 * whole trash is counted by `GET /trash/summary`, because the list is paged and counting what it
 * shows would understate what goes.
 *
 * **Emptying sends the instant the summary counted at**, so anything trashed in another tab while
 * this was open is not destroyed with what was agreed to. Until the summary has answered there is
 * no count to agree to, and the danger button is not offered; that wait, and a summary that never
 * comes, are the only times anything is said under the title.
 *
 * **It closes as soon as the button is pressed** and reports in a toast: how many went, and how
 * many were no longer there to go.
 */

import type { TFunction } from 'i18next';
import { Trans, useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { raiseToast } from '@/app/toasts';
import { Button, Dialog, Modal } from '@/design-system';

import { useBulkPurge, useTrashSummary } from './data';
import type { TrashTally } from './data';
import type { Doomed } from './selection';

export interface BulkPurgeDialogProps {
  open: boolean;
  /** What a selection destroys. Absent when the whole trash is being emptied. */
  selection?: Doomed;
  onClose: () => void;
  /** After the purge has answered, whatever it said. The view clears its selection here. */
  onSettled: () => void;
}

/** What goes, whichever of the two counted it. */
interface Counted {
  recordings: number;
  libraries: number;
}

export function BulkPurgeDialog({ open, selection, onClose, onSettled }: BulkPurgeDialogProps) {
  const { t } = useTranslation('trash');
  const summary = useTrashSummary(open && selection === undefined);
  const bulk = useBulkPurge();

  const counted: Counted | undefined = selection?.tally ?? summary.data;
  const nothing = counted?.recordings === 0 && counted.libraries === 0;

  const report = {
    onSuccess: (destroyed: TrashTally, skipped: readonly string[] = []) => {
      const gone = what(t, destroyed.recordings, destroyed.libraries);
      // One toast, not two: a second would replace the first (`UI-46`).
      raiseToast(
        skipped.length === 0
          ? { tone: 'done', message: t('bulk.done', { what: gone }) }
          : { tone: 'failed', message: t('bulk.skipped', { what: gone, count: skipped.length }) },
      );
    },
    onError: (error: unknown) => {
      raiseToast({
        tone: 'failed',
        message: t('bulk.failed', {
          detail: isApiProblem(error) ? error.detail : t('common:state.offline'),
        }),
      });
    },
  };

  const confirm = () => {
    onClose();
    if (selection !== undefined) {
      bulk.purgeSelection.mutate(selection.body, {
        onSuccess: (result) => {
          report.onSuccess(result.destroyed, result.skipped);
        },
        onError: report.onError,
        onSettled,
      });
    } else if (summary.data !== undefined) {
      bulk.emptyTrash.mutate(summary.data.counted_at, {
        onSuccess: (destroyed) => {
          report.onSuccess(destroyed);
        },
        onError: report.onError,
        onSettled,
      });
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Dialog
        title={
          counted === undefined || nothing ? (
            t('emptyTrash')
          ) : (
            <Trans
              t={t}
              i18nKey="bulk.title"
              values={{ what: what(t, counted.recordings, counted.libraries) }}
              components={{
                count: (
                  <span style={{ fontWeight: 'var(--weight-regular)', color: 'var(--text-2)' }} />
                ),
              }}
            />
          )
        }
        {...(counted === undefined && {
          description: t(summary.isError ? 'bulk.uncounted' : 'bulk.counting'),
        })}
        {...(nothing && { description: t('empty.title') })}
        onClose={onClose}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            {/* Enter on a dialog opened by habit has to cancel, never destroy. */}
            <Button variant="ghost" type="button" data-initial-focus="" onClick={onClose}>
              {t('common:action.cancel')}
            </Button>
            {counted !== undefined && !nothing && (
              <Button variant="danger" type="button" onClick={confirm}>
                {t('bulk.action')}
              </Button>
            )}
          </>
        }
      />
    </Modal>
  );
}

/** "12 recordings", "1 library", or "12 recordings and 1 library". */
function what(t: TFunction<'trash'>, recordings: number, libraries: number): string {
  const counted = t('bulk.recordings', { count: recordings });
  if (libraries === 0) return counted;
  const holding = t('bulk.libraries', { count: libraries });
  return recordings === 0 ? holding : t('bulk.pair', { first: counted, second: holding });
}
