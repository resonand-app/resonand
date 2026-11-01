/**
 * The confirmation for sending a whole library to the trash (`UI-17f`, §V7).
 *
 * **Recoverable, and the confirm says so.** Deletion here is a `deleted_at` on one row: the ACL
 * stops resolving the library and not a single recording is touched, which is what makes restoring
 * it a one-line operation. So this dialog says it can come back, and for how long; the one that
 * deletes from the trash for good says it cannot be undone instead, and that sentence is the
 * whole difference between the two (`DEC-28`).
 *
 * **What it owes is the count and the window.** How many recordings go with it, and how long it
 * can come back -- read from the instance rather than written here, because the retention period
 * is an operator's setting and a number baked into the bundle would be a promise the deployment
 * does not keep. Until the instance has answered, the window is left out rather than guessed: "0
 * days" computed from a number that has not arrived is the one thing this must not say.
 *
 * It is the dialog and not the control that opens it: the settings screen offers a danger button
 * under a heading, and the landing page offers a row in a card's menu, which are two gestures for
 * one consequence. Where to go afterwards is the caller's as well, because it differs -- a
 * settings screen for a library that no longer resolves has to be left, and the grid the card was
 * in only has to be told. What it went to is the same from both, so the toast that says so, with
 * *Undo*, is raised here (`UI-47`).
 */

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { isApiProblem } from '@/api/problem';
import { useInstance } from '@/app/session';
import { raiseToast, reportOn } from '@/app/toasts';
import { Button, Dialog, Modal } from '@/design-system';
import { useTrashLibrary } from '@/features/library-settings/data';

export interface TrashLibraryDialogProps {
  library: { uuid: string; name: string; audio_count: number };
  open: boolean;
  onClose: () => void;
  /** After it is gone. The caller decides whether that means going somewhere else. */
  onTrashed: () => void;
}

export function TrashLibraryDialog({ library, open, onClose, onTrashed }: TrashLibraryDialogProps) {
  const { t } = useTranslation('librarySettings');
  const retention = useInstance().data?.trash_retention_days;
  const trash = useTrashLibrary(library.uuid);
  const client = useQueryClient();
  const { uuid, name } = library;

  const restore = () =>
    reportOn(
      async () => {
        await post('/api/libraries/{library_uuid}/restore', { path: { library_uuid: uuid } });
        await invalidate(client, { kind: 'library', library: uuid });
      },
      { message: t('trash.restored', { name }) },
    );

  const trashed = () => {
    raiseToast({
      tone: 'done',
      message: t('trash.done', { name }),
      action: {
        label: t('common:action.undo'),
        run: () => {
          void restore();
        },
      },
    });
    onTrashed();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Dialog
        title={t('trash.title', { name: library.name })}
        description={[
          t('trash.body', { count: library.audio_count }),
          retention === undefined ? undefined : t('trash.window', { count: retention }),
        ]
          .filter((part) => part !== undefined)
          .join(' ')}
        onClose={onClose}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={onClose}>
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="danger"
              type="button"
              disabled={trash.isPending}
              onClick={() => {
                // Not `mutate`'s own `onSuccess`: the invalidation unmounts a settings screen whose
                // library no longer resolves, and that callback is skipped once nothing observes it.
                trash.mutateAsync().then(trashed, () => undefined);
              }}
            >
              {t('trash.confirm')}
            </Button>
          </>
        }
      >
        {trash.error !== null && (
          <p
            style={{
              margin: 0,
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--state-failed)',
            }}
            role="alert"
          >
            {/* Whatever the instance said, shown rather than replaced (§1.9). An account's last
                library reaches this only through a direct request, and the API's own sentence
                explains it better than a second one written here would. */}
            {isApiProblem(trash.error) ? trash.error.detail : t('error.title')}
          </p>
        )}
      </Dialog>
    </Modal>
  );
}
