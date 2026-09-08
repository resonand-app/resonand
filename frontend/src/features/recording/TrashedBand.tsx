/**
 * A recording that is in the trash (`UI-11d`, §V5).
 *
 * **It can be played and it can be put back. It cannot be edited.** That is not a permission --
 * being in the trash is a state, and the level somebody had before it went in is the level they
 * have now (`REV-7`) -- so restoring asks the level while every field on the screen is drawn as a
 * fact. Somebody arriving here from V9 wants to know two things: that this is the thing they were
 * looking for, and how long they have.
 *
 * **A persistent band, not a toast** (§V5). It says what it is and when it will be purged, and it
 * stays there for as long as that is true. A message about a deletion that vanishes after four
 * seconds is a message that has to be read at exactly the wrong moment.
 *
 * **The days left are computed from the instance's own retention** (`GET /instance`), not from a
 * number written down here: an operator who set thirty days would otherwise be told fourteen by
 * their own software.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { useInstance } from '@/app/session';
import { Button } from '@/design-system';
import { daysLeft } from '@/i18n/time';

import type { RecordingContext } from './data';

export function TrashedBand({ context }: { context: RecordingContext }) {
  const { t } = useTranslation('recording');
  const client = useQueryClient();
  const instance = useInstance();
  const recording = context.recording;

  if (recording?.deleted_at == null) return null;

  const retention = instance.data?.trash_retention_days;
  const left = retention === undefined ? undefined : daysLeft(recording.deleted_at, retention);

  const restore = async () => {
    await post('/api/audio/{audio_uuid}/restore', { path: { audio_uuid: recording.uuid } });
    await invalidate(client, {
      kind: 'recording-lifecycle',
      recording: recording.uuid,
      library: recording.library_uuid,
    });
  };

  return (
    <div
      data-app="trashed-band"
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        flexWrap: 'wrap',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-4)',
        background: 'var(--surface-2)',
        borderRadius: 'var(--radius-control)',
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 220,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-2)',
        }}
      >
        {/* The count, or the fact without it while the instance's retention is still coming:
            a "0 days left" drawn from a missing number is the one thing this must not say. */}
        {left === undefined
          ? t('trashed.body')
          : `${t('trashed.body')} ${t('trashed.left', { count: left })}`}
      </span>
      {context.canRestore && (
        <Button
          variant="secondary"
          onClick={() => {
            void restore();
          }}
        >
          {t('trashed.restore')}
        </Button>
      )}
    </div>
  );
}
