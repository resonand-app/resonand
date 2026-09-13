/**
 * Which transcript is shown, and asking for another (`UI-14a`, `UI-25a`, §V5).
 *
 * **It is only there when there is a choice.** One transcript is not a version, it is the
 * transcript, and a selector offering one option is a control that teaches somebody there is
 * something to decide when there is not. Re-transcribing is what makes a second one exist, so
 * that control is here whatever the count -- and without it, re-transcription is unreachable from
 * the interface and the versions it produces could never appear.
 *
 * **Switching is atomic on the server** (`JOB-7`): a new transcript is written and `is_active`
 * moves in one transaction, so there is no moment where a recording has none. The interface does
 * not have to defend against a half-switched state, and it does not pretend to -- it asks, and
 * re-reads.
 *
 * **Asking for another transcription says where the audio goes first** (`UI-25a`, §3.4). It is the
 * same endpoint as the call to action and the retry, so it is the same disclosure: this is a
 * request path, and there are no request paths without one.
 *
 * Each version is named by what distinguishes it -- the provider, the model, the language and when
 * it was made -- because "v1" and "v2" say nothing about why somebody would want the other one.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { post } from '@/api/client';
import { invalidate } from '@/api/invalidate';
import { Button, EgressNotice } from '@/design-system';
import { instant } from '@/i18n/time';
import { useEgressLabels } from '@/i18n/egress-labels';

import type { RecordingContext } from './data';
import { useDestination, useTranscribe } from './transcription';
import type { Transcripts } from './transcripts';

export interface TranscriptVersionsProps {
  context: RecordingContext;
  transcripts: Transcripts;
}

export function TranscriptVersions({ context, transcripts }: TranscriptVersionsProps) {
  const { t, i18n } = useTranslation('recording');
  const egressLabels = useEgressLabels();
  const recording = context.recording;
  const destination = useDestination();
  const transcribe = useTranscribe(recording?.uuid ?? '');
  const activate = useActivate(recording?.uuid ?? '');

  if (recording === undefined) return null;

  const where = destination.data;
  const mayAsk = context.canEdit && (where?.configured ?? false);
  const versions = transcripts.versions;
  // Only offered where there is another transcript to make: the three states before `done` have
  // their own call to action, and two controls asking for the same thing on one screen is one too
  // many (`UI-15a`).
  const mayAskAgain = mayAsk && versions.length > 0;

  if (versions.length <= 1 && !mayAskAgain) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--type-overline-size)',
          fontWeight: 'var(--type-overline-weight)',
          letterSpacing: 'var(--type-overline-tracking)',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {t('versions.label')}
      </span>
      {versions.length > 1 && (
        <ul
          aria-label={t('versions.label')}
          style={{
            margin: 0,
            padding: 0,
            listStyle: 'none',
            display: 'grid',
            gap: 'var(--space-2)',
          }}
        >
          {versions.map((version, index) => (
            <li
              key={version.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--type-ui-size-sm)',
                  color: version.is_active ? 'var(--text)' : 'var(--text-2)',
                }}
              >
                {/* Counted from the oldest, so `v1` stays the first one that was made. */}
                {t('versions.version', { version: versions.length - index })}
                <span style={{ color: 'var(--text-3)' }}>
                  {` · ${[version.model ?? version.provider ?? t('versions.unknownModel'), version.language ?? t('versions.unknownLanguage'), instant(version.created_at, i18n.language)].join(' · ')}`}
                </span>
              </span>
              {version.is_active ? (
                <span
                  style={{
                    flex: '0 0 auto',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--type-overline-size)',
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--type-overline-tracking)',
                    color: 'var(--accent-on-soft)',
                  }}
                >
                  {t('versions.active')}
                </span>
              ) : (
                context.canEdit && (
                  <Button
                    variant="ghost"
                    disabled={activate.isPending}
                    onClick={() => {
                      activate.mutate(version.id);
                    }}
                  >
                    {t('versions.show')}
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      {mayAskAgain && where !== undefined && (
        <EgressNotice
          destination={where}
          placement="retry"
          labels={egressLabels}
          action={
            <Button
              variant="ghost"
              disabled={transcribe.isPending}
              onClick={() => {
                transcribe.mutate();
              }}
            >
              {t('versions.again')}
            </Button>
          }
        />
      )}
    </div>
  );
}

/**
 * Switch which transcript is shown.
 *
 * The whole recording is invalidated rather than only the transcript: the active transcript
 * decides the segment count, which version the essentials line names, and what a search matches
 * inside -- and `invalidate` is the one place that knows that list (`UI-3c`).
 */
function useActivate(uuid: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      post('/api/audio/{audio_uuid}/transcripts/{transcript_id}/activate', {
        path: { audio_uuid: uuid, transcript_id: id },
      }),
    onSuccess: async () => {
      await invalidate(client, { kind: 'transcription', recording: uuid });
    },
  });
}
