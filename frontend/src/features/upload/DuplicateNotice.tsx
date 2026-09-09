/**
 * This exact file is already here (`UI-18d`, `DEC-16`, §V-E).
 *
 * **A warning, never a silent block.** It names the recording that is already in the archive, says
 * whether it is in the trash, and leaves the decision with the person: send it anyway, or leave it
 * alone. Byte-identical only -- a re-encoded copy of the same conversation hashes differently, and
 * the wording must not imply the archive can tell.
 *
 * **When the copy is in the trash, the offer is to restore that one instead.** Trashed matches are
 * deliberately included in the check, because excluding them would let somebody upload a file,
 * then restore the copy they had deleted, and end up with the real duplicate. Restoring is also
 * the better answer: the recording that comes back has its title, its notes, its tags and its
 * transcript, and a fresh upload has none of them.
 *
 * The restore happens here rather than in the queue because this is where React and the query
 * cache are: a store outside the routes has no client to tell what went stale.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { Button } from '@/design-system';

import { useUploads } from './uploads';
import type { Upload } from './uploads';

export function DuplicateNotice({ upload }: { upload: Upload }) {
  const { t } = useTranslation('upload');
  const client = useQueryClient();
  const decide = useUploads((state) => state.decide);
  const duplicate = upload.duplicate;

  const restore = useMutation({
    mutationFn: (uuid: string) =>
      post('/api/audio/{audio_uuid}/restore', { path: { audio_uuid: uuid } }),
    onSuccess: async (_result, uuid) => {
      await invalidate(client, { kind: 'recording-lifecycle', recording: uuid });
      decide(upload.id, 'skip');
    },
  });

  if (duplicate === undefined) return null;

  return (
    <div
      data-app="duplicate-notice"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          lineHeight: 'var(--type-body-leading)',
          color: 'var(--text-2)',
          textWrap: 'pretty',
        }}
      >
        {t(duplicate.in_trash ? 'duplicate.inTrash' : 'duplicate.here', {
          name: duplicate.title,
        })}
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {duplicate.in_trash && (
          <Button
            variant="secondary"
            disabled={restore.isPending}
            onClick={() => {
              restore.mutate(duplicate.uuid);
            }}
          >
            {t('duplicate.restore')}
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            decide(upload.id, 'upload');
          }}
        >
          {t('duplicate.anyway')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            decide(upload.id, 'skip');
          }}
        >
          {t('duplicate.skip')}
        </Button>
      </div>
    </div>
  );
}
