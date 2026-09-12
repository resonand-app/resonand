/**
 * The tray, and the phone's Upload tab (`UI-18e`, §3.3, §2.3).
 *
 * **It is not a modal, and that is the whole requirement.** An upload must survive a navigation
 * and a tab switch, and an hours-long file makes that concrete -- so the transfers live in a store
 * outside the routes and this draws them from wherever somebody happens to be. It is handed to the
 * frame, like the player, rather than rendered inside a view.
 *
 * **Absent rather than empty.** With nothing uploading there is no tray and the shell reflows,
 * which is the same rule the player follows: a permanent empty strip above the player would be a
 * band of chrome that means nothing most of the time.
 *
 * **It collapses to one line rather than closing**, because thirty files take long enough that
 * somebody will want the screen back and short enough that they will want to know. The summary is
 * the same sentence in both states, so collapsing loses the list and never the answer. There is no
 * close control until everything has finished: the tray is the only place an upload's progress
 * exists, and a close button beside a running upload is one somebody presses.
 *
 * **A finished upload is told to the cache, once.** A recording that has arrived changes a
 * library's count and its list, and the store cannot say so -- it is outside React and has no
 * query client. So the tray watches what it is drawing and invalidates as each one lands.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { invalidate } from '@/api/invalidate';
import { UploadTray } from '@/components/UploadTray';
import { Button, Progress } from '@/design-system';
import { bytes, percent } from '@/i18n/format';

import { DuplicateNotice } from './DuplicateNotice';
import { useUploads } from './uploads';
import type { Upload } from './uploads';

/**
 * How full the bar is, which is not one number (`FBK-5`).
 *
 * Hashing and sending are two passes over the same file and each has its own count. Drawing the
 * sent bytes during the hash would pin the bar at nought for minutes, which is the shape of a
 * frozen interface -- and it was, at the sizes this product accepts.
 */
function fractionOf(upload: Upload): number {
  if (upload.size === 0) return 0;
  return (upload.status === 'checking' ? upload.hashed : upload.sent) / upload.size;
}

/**
 * The one-line answer: "3 of 30 uploaded, 1 failed".
 *
 * Shown collapsed and expanded alike, and it names the failures rather than only counting the
 * successes: at thirty files some of them failing is the ordinary outcome, and a summary that
 * said "27 of 30 uploaded" would leave somebody to work out the rest by subtraction.
 */
function useSummary(files: readonly Upload[]): string {
  const { t } = useTranslation('upload');
  const done = files.filter((one) => one.status === 'done').length;
  const failed = files.filter(
    (one) => one.status === 'failed' || one.status === 'too-large',
  ).length;
  const summary = t('tray.summary', { done, total: files.length });
  return failed === 0 ? summary : `${summary}, ${t('tray.failed', { count: failed })}`;
}

export function Uploads() {
  const files = useUploads((state) => state.files);
  const collapsed = useUploads((state) => state.collapsed);
  const setCollapsed = useUploads((state) => state.setCollapsed);
  const clear = useUploads((state) => state.clear);
  const summary = useSummary(files);
  useSettled(files);

  if (files.length === 0) return null;
  const going = files.some((one) => one.status !== 'done' && one.status !== 'skipped');

  return (
    <UploadTray
      summary={summary}
      collapsed={collapsed}
      onToggle={() => {
        setCollapsed(!collapsed);
      }}
      {...(going ? {} : { onClose: clear })}
    >
      <FileRows files={files} />
    </UploadTray>
  );
}

/**
 * The phone's Upload tab.
 *
 * A tab and not a modal for the same reason the tray is not one (§2.3), and it has to say
 * something when nothing is going -- a tab that is blank two thirds of the time is a tab nobody
 * presses twice. There is no drag and drop here: the entry point is the system's own file and
 * recording picker, which is what the dialog opens.
 */
export function UploadPanel({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation('upload');
  const files = useUploads((state) => state.files);
  useSettled(files);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <Button variant="primary" icon="upload" onClick={onAdd}>
        {t('tray.add')}
      </Button>
      {files.length === 0 ? (
        <p style={{ margin: 0, fontSize: 'var(--type-ui-size-sm)', color: 'var(--text-3)' }}>
          {t('tray.nothing')}
        </p>
      ) : (
        <FileRows files={files} />
      )}
    </section>
  );
}

/** One row per file: what it is, how far it has got, and what it is waiting on. */
function FileRows({ files }: { files: readonly Upload[] }) {
  const { t } = useTranslation('upload');
  const again = useUploads((state) => state.again);

  /** The right-hand side of a row: how far, or what happened. */
  const detailOf = (upload: Upload): string => {
    // The phase is named beside the number while the number is still moving: "72%" alone does not
    // say whether this file is being read or being sent, and they take very different times.
    if (upload.status === 'checking') {
      return `${percent(fractionOf(upload))} · ${t('tray.status.checking')}`;
    }
    if (upload.status === 'uploading') {
      return `${percent(fractionOf(upload))} · ${bytes(upload.size)}`;
    }
    return t(`tray.status.${upload.status}`);
  };

  /** Why a file will not be sent, or was not, in the words that let somebody act on it. */
  const reason = (upload: Upload): string | undefined => {
    if (upload.status === 'too-large') {
      // The instance's own limit, as a number. "Too large" without one is a dead end.
      return t('tray.tooLarge', {
        size: bytes(upload.size),
        limit: bytes(upload.maxBytes),
      });
    }
    return upload.status === 'failed' ? upload.error : undefined;
  };

  return (
    <ul
      aria-label={t('tray.files')}
      style={{
        margin: 0,
        padding: 0,
        listStyle: 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
      }}
    >
      {files.map((upload) => (
        <li
          key={upload.id}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
        >
          <Progress value={fractionOf(upload)} label={upload.name} detail={detailOf(upload)} />
          {reason(upload) !== undefined && (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size-sm)',
                lineHeight: 'var(--type-body-leading)',
                color: 'var(--state-failed)',
                textWrap: 'pretty',
              }}
            >
              {reason(upload)}
            </span>
          )}
          {upload.status === 'failed' && (
            <div>
              {/* "Again", never "resume": the request starts from the first byte, and a control
                  that implied otherwise would be the interface promising something the endpoint
                  cannot do. */}
              <Button
                variant="ghost"
                onClick={() => {
                  again(upload.id);
                }}
              >
                {t('tray.again')}
              </Button>
            </div>
          )}
          {upload.status === 'duplicate' && <DuplicateNotice upload={upload} />}
        </li>
      ))}
    </ul>
  );
}

/**
 * Tell the cache about the recordings that have arrived.
 *
 * Each uuid once: the library's count, its list and search all change when a recording lands, and
 * `invalidate` already knows which of them that is. Uploading is the one place in the interface
 * where the thing that made the change cannot say so itself.
 */
function useSettled(files: readonly Upload[]): void {
  const client = useQueryClient();
  const told = useRef(new Set<string>());

  useEffect(() => {
    for (const upload of files) {
      if (upload.status !== 'done' || upload.uuid === undefined) continue;
      if (told.current.has(upload.uuid)) continue;
      told.current.add(upload.uuid);
      void invalidate(client, { kind: 'upload', library: upload.library });
    }
  }, [files, client]);
}
