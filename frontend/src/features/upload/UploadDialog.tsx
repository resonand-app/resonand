/**
 * The dialog that starts an upload (`UI-18a`, §V-E).
 *
 * **It picks the files and the destination, and then it gets out of the way.** The transfers
 * belong to `uploads.ts` and the tray, not to this component: a dialog that owned them would abort
 * an hour of driving the moment somebody closed it, which is the one thing `UI-18` forbids. So
 * pressing Upload hands the files over and closes.
 *
 * **What is accepted is stated before a file is chosen**, and it is read from the instance rather
 * than written here. An operator can raise `max_upload_bytes`, and a limit hard-coded in the
 * bundle would be a promise the deployment does not keep.
 *
 * **Video is accepted, kept whole and played as audio**, and the dialog says so. The file with
 * your grandmother in it is quite often the mp4, and somebody who has been told "audio archive"
 * will not try one unless the screen tells them it works.
 *
 * A file the instance does not ingest is named and refused here rather than sent and refused
 * there. It is the same rule read from the same list -- `accepted_extensions` -- and not a second
 * one: the backend still decides, and this only saves somebody from watching thirty files fail.
 */

import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dialog, Icon, Modal } from '@/design-system';
import { bytes } from '@/i18n/format';

import { isAccepted, isVideo, useInstance } from './instance';
import { useUploads } from './uploads';

export interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** Where the person opening it came from, which is where the recordings go by default. */
  library?: string | undefined;
}

export function UploadDialog({ open, onClose, library }: UploadDialogProps) {
  const { t } = useTranslation('upload');
  const instance = useInstance();
  const add = useUploads((state) => state.add);
  const picker = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<File[]>([]);
  const [over, setOver] = useState(false);

  const accepted = chosen.filter((file) => isAccepted(file.name, instance));
  const refused = chosen.filter((file) => !isAccepted(file.name, instance));

  function close() {
    setChosen([]);
    setOver(false);
    onClose();
  }

  function take(files: FileList | null) {
    if (files === null) return;
    // Added rather than replaced: somebody choosing a second folder means both, and a picker
    // that forgot the first one is a picker they have to be careful with.
    setChosen((was) => [...was, ...Array.from(files)]);
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files);
  }

  return (
    <Modal open={open} onClose={close}>
      <Dialog
        title={t('dialog.title')}
        onClose={close}
        width={520}
        labels={{ close: t('common:action.close') }}
        footer={
          <>
            <Button variant="ghost" type="button" onClick={close}>
              {t('common:action.cancel')}
            </Button>
            <Button
              variant="primary"
              type="button"
              disabled={accepted.length === 0 || library === undefined}
              onClick={() => {
                if (library === undefined) return;
                add(accepted, { library });
                close();
              }}
            >
              {t('dialog.submit', { count: accepted.length })}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* The drop zone is a label around the input, so the whole area is the control a
              keyboard reaches and a pointer presses -- rather than a div with a click handler
              beside a hidden field nothing announces. */}
          <label
            data-app="drop-zone"
            data-over={over ? 'true' : undefined}
            onDragOver={(event) => {
              event.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => {
              setOver(false);
            }}
            onDrop={drop}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-6) var(--space-4)',
              borderRadius: 'var(--radius-panel)',
              border: '1px dashed var(--hairline-strong)',
              background: over ? 'var(--accent-soft)' : 'var(--surface-2)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            <Icon name="cloud-upload" size={26} color="var(--text-3)" />
            <span style={{ fontSize: 'var(--type-ui-size)', color: 'var(--text)' }}>
              {t('dialog.drop')}
            </span>
            <span style={{ fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
              {t('dialog.limit', { size: bytes(instance?.max_upload_bytes) })}
            </span>
            <input
              ref={picker}
              type="file"
              multiple
              accept={instance?.accepted_extensions.join(',')}
              onChange={(event) => {
                take(event.target.files);
                // Cleared so choosing the same file twice in a row is two events rather than one.
                event.target.value = '';
              }}
              // Present and reachable, not `display: none`: the label is the visible control and
              // the input is the one the browser opens a picker for, so it has to still be there.
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          </label>

          <p style={{ margin: 0, fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
            {t('dialog.formats', { formats: (instance?.accepted_extensions ?? []).join(' ') })}
          </p>
          <p style={{ margin: 0, fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
            {t('dialog.video')}
          </p>

          {chosen.length > 0 && (
            <ul
              aria-label={t('dialog.chosen')}
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                maxHeight: 220,
                overflowY: 'auto',
              }}
            >
              {chosen.map((file, index) => (
                <li
                  key={`${file.name}-${String(index)}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: 'var(--type-ui-size-sm)',
                    color: isAccepted(file.name, instance) ? 'var(--text-2)' : 'var(--danger)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {file.name}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'var(--type-numeric-variant)',
                      color: 'var(--text-3)',
                    }}
                  >
                    {isVideo(file.name, instance) ? t('dialog.asAudio') : bytes(file.size)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {refused.length > 0 && (
            <p style={{ margin: 0, fontSize: 'var(--type-ui-size-sm)', color: 'var(--danger)' }}>
              {t('dialog.refused', {
                count: refused.length,
                names: refused.map((file) => file.name).join(', '),
              })}
            </p>
          )}
        </div>
      </Dialog>
    </Modal>
  );
}
