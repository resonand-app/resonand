/**
 * Sending a whole library to the trash (`UI-17f`, §V7).
 *
 * **Recoverable, and the confirm says so.** Deletion here is a `deleted_at` on one row: the ACL
 * stops resolving the library and not a single recording is touched, which is what makes restoring
 * it a one-line operation. So this is an ordinary dialog with a danger button and not
 * `TypedConfirm` -- typing a name out is the gesture that means "this cannot be undone", and
 * spending it on something that can be undone is how it stops meaning anything on the day it is
 * needed (`UI-34m`).
 *
 * **What it owes is the count and the window.** How many recordings go with it, and how long it
 * can come back -- read from the instance rather than written here, because the retention period
 * is an operator's setting and a number baked into the bundle would be a promise the deployment
 * does not keep. Until the instance has answered, the window is left out rather than guessed: "0
 * days" computed from a number that has not arrived is the one thing this must not say.
 *
 * Afterwards there is nothing to be on: the library it was about is gone from every list, so it
 * leaves for the landing page rather than staying on a settings screen for something that no
 * longer resolves.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { routes } from '@/app/routes';
import { useInstance } from '@/app/session';
import { Button, Dialog, Modal } from '@/design-system';

import { useTrashLibrary } from './data';

export interface TrashLibraryProps {
  library: { uuid: string; name: string; audio_count: number };
}

export function TrashLibrary({ library }: TrashLibraryProps) {
  const { t } = useTranslation('librarySettings');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const retention = useInstance().data?.trash_retention_days;
  const trash = useTrashLibrary(library.uuid);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div>
        <Button
          variant="danger"
          icon="trash-2"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('trash.action')}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      >
        <Dialog
          title={t('trash.title', { name: library.name })}
          description={[
            t('trash.body', { count: library.audio_count }),
            retention === undefined ? undefined : t('trash.window', { count: retention }),
          ]
            .filter((part) => part !== undefined)
            .join(' ')}
          onClose={() => {
            setOpen(false);
          }}
          labels={{ close: t('common:action.close') }}
          footer={
            <>
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setOpen(false);
                }}
              >
                {t('common:action.cancel')}
              </Button>
              <Button
                variant="danger"
                type="button"
                disabled={trash.isPending}
                onClick={() => {
                  trash.mutate(undefined, {
                    onSuccess: () => {
                      setOpen(false);
                      void navigate(routes.libraries);
                    },
                  });
                }}
              >
                {t('trash.confirm')}
              </Button>
            </>
          }
        >
          {trash.error !== null && (
            <p
              style={{ margin: 0, fontSize: 'var(--type-ui-size-sm)', color: 'var(--danger)' }}
              role="alert"
            >
              {/* Whatever the instance said, shown rather than replaced (§1.9). A personal
                  library reaches this only through a direct request, and the API's own sentence
                  explains it better than a second one written here would. */}
              {isApiProblem(trash.error) ? trash.error.detail : t('error.title')}
            </p>
          )}
        </Dialog>
      </Modal>
    </section>
  );
}
