/**
 * What can be done with a recording (`UI-13e`, §V5).
 *
 * **It sits in the page header, beside the control that folds the panel away.** It was the last
 * block inside that panel, which put the four things somebody does to a recording behind a fold,
 * below eight fields and a collapsed technical section -- and gone entirely on a screen where the
 * panel was closed. Actions belong where a view's actions belong, and the header is where this
 * view already has one.
 *
 * **So they are glyphs.** Four labelled buttons do not fit a header that also carries a title and
 * a four-fact line, and download, share, move and trash are four a person reads off an icon. The
 * words are their accessible names, not lost.
 *
 * **Download is always there, for everybody who can hear it.** Principle 1 is that the original
 * is yours and is kept byte for byte; a screen that can play a recording but not give it back
 * would be a claim the software does not honour. It is a link to `GET /audio/{uuid}/original` and
 * not a handler, because a download is a navigation the browser already knows how to do -- it can
 * be opened in a new tab, saved from the context menu, and needs no fetch, no blob and no progress
 * the interface would have to invent.
 *
 * **Everything else is absent rather than disabled** (§3.5, `UI-10c`). A row of greyed-out
 * buttons reads as a bug; their absence reads as a decision, and the decision was made by whoever
 * shared the library. Move and Trash need level 20; **Share needs 30 on the library**,
 * which is stricter than `UI-13e`'s line and deliberately so: access to a recording is granted on
 * the library it sits in (`UI-17`), sharing one recording on its own is not in v0, and a way into
 * a screen the API refuses is worse than no way in.
 *
 * **Sending something to the trash says what that means first.** Not a typed confirmation -- that
 * is V9's hard delete, where something is actually destroyed -- but a dialog stating the retention
 * the instance is configured with, read from `GET /instance` rather than written down here.
 * Afterwards it goes back to the library, because somebody who has just sent a recording away is
 * not looking at that recording any more.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { post, remove } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { toLibrary, toLibrarySettings } from '@/app/routes';
import { useInstance } from '@/app/session';
import { MoveDialog } from '@/components/MoveDialog';
import { Button, Dialog, IconButton, Modal } from '@/design-system';

import type { RecordingContext } from './data';
import { originalUrl } from './original';

export function RecordingActions({ context }: { context: RecordingContext }) {
  const { t } = useTranslation('recording');
  const navigate = useNavigate();
  const client = useQueryClient();
  const instance = useInstance();
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const recording = context.recording;

  if (recording === undefined) return null;

  const library = context.library;

  const trash = async () => {
    await remove('/api/audio/{audio_uuid}', { path: { audio_uuid: recording.uuid } });
    await invalidate(client, {
      kind: 'recording-lifecycle',
      recording: recording.uuid,
      library: recording.library_uuid,
    });
    setConfirming(false);
    if (library !== undefined) void navigate(toLibrary(library.uuid));
  };

  const move = async (destination: string) => {
    setMoving(false);
    await post('/api/audio/{audio_uuid}/move', {
      path: { audio_uuid: recording.uuid },
      body: { library_uuid: destination },
    });
    // Both libraries: the one that lost a recording shows a count too, and this screen is now
    // showing a recording that belongs somewhere else.
    await invalidate(client, {
      kind: 'recording-moved',
      recording: recording.uuid,
      from: recording.library_uuid,
      to: destination,
    });
  };

  return (
    <>
      <IconButton
        icon="download"
        variant="ghost"
        label={t('actions.download')}
        href={originalUrl(recording.uuid)}
        download
      />
      {context.canShare && library !== undefined && (
        <IconButton
          icon="share-2"
          variant="ghost"
          label={t('actions.share')}
          onClick={() => {
            void navigate(toLibrarySettings(library.uuid));
          }}
        />
      )}
      {context.canEdit && (
        <IconButton
          icon="folder-input"
          variant="ghost"
          label={t('actions.move')}
          onClick={() => {
            setMoving(true);
          }}
        />
      )}
      {context.canEdit && (
        <IconButton
          icon="trash-2"
          variant="ghost"
          label={t('actions.trash')}
          onClick={() => {
            setConfirming(true);
          }}
        />
      )}
      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <Dialog
          title={t('actions.trashTitle')}
          description={t('actions.trashConsequence', {
            count: instance.data?.trash_retention_days ?? 0,
          })}
          onClose={() => {
            setConfirming(false);
          }}
          labels={{ close: t('common:action.close') }}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {t('common:action.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  void trash();
                }}
              >
                {t('actions.trash')}
              </Button>
            </>
          }
        />
      </Modal>
      {moving && (
        <MoveDialog
          recordings={[recording]}
          categoryName={(id) => context.categories.nameOf(id)}
          onClose={() => {
            setMoving(false);
          }}
          onConfirm={(destination) => {
            void move(destination);
          }}
        />
      )}
    </>
  );
}
