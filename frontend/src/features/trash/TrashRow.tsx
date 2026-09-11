/**
 * One thing in the trash, and what can be done to it (`INT-1b`, `INT-1c`, `INT-1d`, §V9).
 *
 * **The type is a marker on the row**, because the list is one list: a library and a recording
 * sit in the same column in the same order, and what tells them apart is a word and an icon
 * rather than a heading somebody has to scroll to.
 *
 * **A trashed library's separately-trashed recordings are grouped under it**, and the hard case
 * is answered on the child rather than hidden: restoring it alone puts it back into a library
 * that is still in the trash, where nobody would see it. So the child says that, and offers to
 * restore the library too -- which is the only answer that leaves somebody where they expected
 * to be.
 *
 * **Restore is one call per item and Delete now is `TypedConfirm`.** The asymmetry is the point.
 * Restoring is free and reversible, so it is a button; destroying is neither, so it costs the
 * name typed out and states what goes in numbers first (`UI-34m`).
 *
 * **The last day is marked unmistakably**, because it is the only row on this screen where doing
 * nothing is a decision.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { colourOf } from '@/app/library-data';
import { Button, Chip, TypedConfirm } from '@/design-system';
import { total } from '@/i18n/format';
import { daysLeft, instant } from '@/i18n/time';

import type { TrashActions, TrashEntry, TrashedLibrary, TrashedRecording } from './data';

export interface TrashRowProps {
  entry: TrashEntry;
  /** From `GET /instance`. `undefined` until it has answered, and then no countdown is drawn. */
  retention: number | undefined;
  actions: TrashActions;
}

export function TrashRow({ entry, retention, actions }: TrashRowProps) {
  const { t } = useTranslation('trash');

  if (entry.kind === 'recording') {
    return (
      <li>
        <Row
          type={t('type.recording')}
          name={entry.recording.title}
          deletedAt={entry.deletedAt}
          retention={retention}
          onRestore={() => {
            actions.restoreRecording.mutate(entry.recording);
          }}
          purge={{
            name: entry.recording.title,
            consequence: t('destroys.recording'),
            onConfirm: () => {
              actions.purgeRecording.mutate(entry.recording);
            },
          }}
        />
      </li>
    );
  }

  const { library, children } = entry;
  return (
    <li>
      <Row
        type={t('type.library')}
        name={library.name}
        colour={colourOf(library.colour)}
        detail={t('contains', { count: library.audio_count })}
        deletedAt={entry.deletedAt}
        retention={retention}
        onRestore={() => {
          actions.restoreLibrary.mutate(library);
        }}
        purge={{
          name: library.name,
          consequence: t('destroys.library', {
            count: library.audio_count,
            duration: total(library.total_duration_ms),
          }),
          onConfirm: () => {
            actions.purgeLibrary.mutate(library);
          },
        }}
      />
      {children.length > 0 && (
        <ul
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            margin: 'var(--space-2) 0 0',
            // Indented and rule-marked, so a child reads as inside the library above it rather
            // than as the next thing in the list.
            padding: '0 0 0 var(--space-6)',
            borderLeft: '1px solid var(--hairline)',
            marginLeft: 'var(--space-3)',
            listStyle: 'none',
          }}
        >
          {children.map((child) => (
            <li key={child.uuid}>
              <OrphanedChild
                recording={child}
                library={library}
                retention={retention}
                actions={actions}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * A trashed recording whose library is trashed too (`INT-1b`).
 *
 * The case §V9 says needs an answer on screen. Restoring it on its own succeeds and then appears
 * to have done nothing, because the library it went back to is still in the trash -- so the row
 * says that in advance and offers the restore that actually helps.
 */
function OrphanedChild({
  recording,
  library,
  retention,
  actions,
}: {
  recording: TrashedRecording;
  library: TrashedLibrary;
  retention: number | undefined;
  actions: TrashActions;
}) {
  const { t } = useTranslation('trash');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <Row
        type={t('type.recording')}
        name={recording.title}
        deletedAt={recording.deleted_at ?? ''}
        retention={retention}
        onRestore={() => {
          actions.restoreRecording.mutate(recording);
        }}
        purge={{
          name: recording.title,
          consequence: t('destroys.recording'),
          onConfirm: () => {
            actions.purgeRecording.mutate(recording);
          },
        }}
        note={t('inTrashedLibrary')}
        extra={
          <Button
            variant="secondary"
            onClick={() => {
              // Both, and the library first: restoring the recording into a library that is
              // still in the trash is the outcome this button exists to avoid.
              actions.restoreLibrary.mutate(library);
              actions.restoreRecording.mutate(recording);
            }}
          >
            {t('restoreBoth')}
          </Button>
        }
      />
    </div>
  );
}

interface RowProps {
  /**
   * The marker that makes one list legible: `LIBRARY` or `RECORDING`, in the mono meta face.
   *
   * A word rather than a glyph. The system ships one deliberately small set of glyphs and has no
   * mark for a recording, and inventing one here would be a second vocabulary -- but more than
   * that, a marker only its author can read is not a marker. A library also carries its own
   * colour, which is how libraries are identified everywhere else in the product.
   */
  type: string;
  name: string;
  colour?: string;
  detail?: string;
  note?: string;
  deletedAt: string;
  retention: number | undefined;
  onRestore: () => void;
  purge: { name: string; consequence: string; onConfirm: () => void };
  extra?: React.ReactNode;
}

function Row({
  type,
  name,
  colour,
  detail,
  note,
  deletedAt,
  retention,
  onRestore,
  purge,
  extra,
}: RowProps) {
  const { t } = useTranslation('trash');
  const [confirming, setConfirming] = useState(false);
  const left = retention === undefined ? undefined : daysLeft(deletedAt, retention);
  const isLastDay = left !== undefined && left <= 1;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-panel)',
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {colour !== undefined && (
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                flex: '0 0 auto',
                borderRadius: 'var(--radius-chip)',
                background: colour,
              }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-overline-size)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--type-overline-tracking)',
              color: 'var(--text-3)',
            }}
          >
            {type}
          </span>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            color: 'var(--text)',
            overflowWrap: 'anywhere',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {[detail, instant(deletedAt)].filter(Boolean).join(' · ')}
        </span>
        {note !== undefined && (
          <span
            style={{
              maxWidth: 460,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-2)',
            }}
          >
            {note}
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}
      >
        {left !== undefined && (
          /* The only row where doing nothing is a decision, so the last day is a marked chip and
             every other day is quiet text. */
          <Chip active={isLastDay}>
            {left === 0 ? t('goesToday') : isLastDay ? t('lastDay') : t('left', { count: left })}
          </Chip>
        )}
        {extra}
        <Button variant="secondary" aria-label={t('restoreNamed', { name })} onClick={onRestore}>
          {t('restore')}
        </Button>
        <Button
          variant="danger"
          aria-label={t('deleteNamed', { name })}
          onClick={() => {
            setConfirming(true);
          }}
        >
          {t('deleteNow')}
        </Button>
      </div>
      <TypedConfirm
        open={confirming}
        name={purge.name}
        consequence={purge.consequence}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => {
          setConfirming(false);
          purge.onConfirm();
        }}
      />
    </div>
  );
}
