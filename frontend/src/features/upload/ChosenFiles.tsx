/**
 * What is about to be uploaded, drawn inside the drop zone (`UI-18a`, §V-E).
 *
 * **A tile rather than a row.** Thirty files as thirty lines is a column nobody reads and a dialog
 * that pushes its own Upload button off the screen; five tiles to a row answer the only question
 * somebody has at this moment -- did the right things land here -- in one glance.
 *
 * **The format is written out beside the size**, because a name clipped to fit a tile loses its
 * end, which is the part that says what the file is. Audio and video take different glyphs: video
 * is accepted and kept whole, and somebody who dropped a folder should be able to see which of
 * these are the mp4s without reading a name.
 *
 * **The grid scrolls rather than growing**, so a hundred files leave the destination, the
 * disclosure and the Upload button exactly where they were with one.
 *
 * **A tile is the control that leaves its file out**, which is the only thing that can be done to
 * a file that has not been sent yet. Until this existed, one wrong file meant closing the dialog
 * and choosing the other twenty-nine again.
 */

import { useTranslation } from 'react-i18next';

import { Icon } from '@/design-system';
import type { IconName } from '@/design-system';
import { bytes } from '@/i18n/format';

import { extension, isAccepted, isVideo } from './instance';
import type { InstanceState } from './instance';

export interface ChosenFilesProps {
  files: readonly File[];
  instance: InstanceState | undefined;
  /** Leave this one out. The index, because two files may carry the same name. */
  onRemove: (index: number) => void;
}

/**
 * Two rows and a slice of a third.
 *
 * Cut at a row boundary the grid looks finished, and a sixth file is then invisible -- which is
 * the failure a scroll region exists to prevent rather than to cause.
 */
const GRID_HEIGHT = 176;

/** The three kinds of file: one this instance will not take, a video container, and audio. */
function glyphFor(name: string, instance: InstanceState | undefined): IconName {
  if (!isAccepted(name, instance)) return 'alert-circle';
  return isVideo(name, instance) ? 'file-video' : 'file-audio';
}

export function ChosenFiles({ files, instance, onRemove }: ChosenFilesProps) {
  const { t } = useTranslation('upload');
  return (
    <ul
      aria-label={t('dialog.chosen')}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 'var(--space-2)',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        maxHeight: GRID_HEIGHT,
        overflowY: 'auto',
      }}
    >
      {files.map((file, index) => {
        const refused = !isAccepted(file.name, instance);
        const format = extension(file.name);
        const size = bytes(file.size);
        return (
          <li key={`${file.name}-${String(index)}`}>
            <button
              type="button"
              data-hit-target=""
              title={file.name}
              aria-label={t('dialog.remove', { name: file.name })}
              onClick={() => {
                onRemove(index);
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 'var(--space-1)',
                width: '100%',
                padding: 'var(--space-2) var(--space-1)',
                border: 'none',
                borderRadius: 'var(--radius-control)',
                background: refused ? 'var(--state-failed-bg)' : 'var(--surface)',
                color: refused ? 'var(--state-failed)' : 'var(--text-2)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {/* Always drawn, never on hover: a phone has no hover, and this is the only way off
                  the list. */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: 'var(--space-1)',
                  right: 'var(--space-1)',
                  display: 'flex',
                  color: refused ? 'var(--state-failed)' : 'var(--text-3)',
                }}
              >
                <Icon name="x" size={13} />
              </span>
              <Icon name={glyphFor(file.name, instance)} size={22} />
              <span
                style={{
                  maxWidth: '100%',
                  fontSize: 'var(--type-ui-size-sm)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {file.name}
              </span>
              <span
                style={{
                  maxWidth: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--type-overline-size)',
                  fontVariantNumeric: 'var(--type-numeric-variant)',
                  color: refused ? 'var(--state-failed)' : 'var(--text-3)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {format === '' ? size : t('dialog.fileMeta', { format, size })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
