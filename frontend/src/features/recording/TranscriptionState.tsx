/**
 * The transcription states that are not a transcript (`UI-15a`, `UI-15b`, `UI-15c`, `UI-25a`, §V5).
 *
 * It stands where the transcript would be, because that is what somebody is looking at: a screen
 * whose whole middle is a call to action reads as a screen that knows what is missing, and the
 * same words tucked into a corner of the panel read as an aside.
 *
 * **Nothing here asks for a transcription without first saying where the audio goes** (`UI-25a`,
 * §3.4). `EgressNotice` is above the call to action and beside the retry, in its own two
 * registers -- calm when the provider is on the instance's own network, factual when it is not --
 * and it is drawn from `GET /transcription/destination`, which any caller can read. That endpoint
 * exists for this: a disclosure only administrators can see is not a disclosure.
 *
 * **Nothing configured is a fourth case and not an error.** There is no provider, so there is no
 * call to action either: offering to transcribe would be offering something that cannot happen,
 * and the notice says so plainly in its own words.
 *
 * **`running` has no progress bar** (`UI-15b`, §6). Nothing anywhere stores a percentage, so a
 * bar would be an animation with no number behind it. What there is instead is when it started,
 * which attempt this is once it is past the first, and who is doing it. A job that is queued and
 * has not begun has no elapsed time to report, and says it is waiting rather than counting from a
 * moment that has not happened (`API-17`).
 *
 * **It does turn, though** (`FBK-6`). The glyph spinning is not the bar coming back in another
 * shape: a bar would claim a fraction nobody stores, and this claims only that the job is alive,
 * which is exactly what it is. A still glyph over an elapsed time that advances by itself is the
 * same picture a stalled transcription would draw, and this screen is where somebody sits for
 * minutes waiting to find out which of the two they have.
 *
 * **`failed` shows the provider's own words** (`UI-15c`). The error explains what happened; it
 * does not apologise. That text exists only on the job, which is why `API-17` had to be built
 * before this could be honest -- before it, the person whose recording had failed was the one
 * person on the instance who could not be told why.
 */

import { useTranslation } from 'react-i18next';

import { Button, EgressNotice, StateCard } from '@/design-system';
import { useNow } from '@/app/use-now';
import { relative } from '@/i18n/time';
import { useEgressLabels } from '@/i18n/egress-labels';

import type { RecordingContext } from './data';
import { useDestination, useTranscribe, useTranscriptionStatus } from './transcription';
import type { TranscriptionStatus } from './transcription';

/** Below this, there is no number worth showing and `Intl` has no phrase for it. */
const MINUTE_MS = 60_000;

export interface TranscriptionStateProps {
  context: RecordingContext;
  /** Which of the four states the recording is in, from the recording itself. */
  state: 'none' | 'running' | 'done' | 'failed';
}

export function TranscriptionState({ context, state }: TranscriptionStateProps) {
  const { t, i18n } = useTranslation('recording');
  const egressLabels = useEgressLabels();
  const recording = context.recording;
  const destination = useDestination();
  const status = useTranscriptionStatus(recording?.uuid ?? '', state);
  const transcribe = useTranscribe(recording?.uuid ?? '');

  if (recording === undefined || state === 'done') return null;

  const where = destination.data;
  const configured = where?.configured ?? false;
  // Level 20 to spend somebody's provider quota, which is what the endpoint requires.
  const mayAsk = context.canEdit && configured;
  const asking = transcribe.isPending;

  const notice =
    where === undefined ? null : <EgressNotice destination={where} labels={egressLabels} />;

  if (state === 'running') {
    return (
      <StateCard
        icon="loader"
        // The one thing in the product that moves on its own besides the transcript: work is
        // running on a provider right now, and a still glyph is the same picture as a stalled one.
        busy
        title={t('transcription.running.title')}
        body={<Running status={status.data} provider={where?.provider} language={i18n.language} />}
      />
    );
  }

  if (state === 'failed') {
    return (
      <StateCard
        icon="alert-circle"
        title={t('transcription.failed.title')}
        body={
          <span style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {/* The provider's own words, shown rather than replaced (§1.9). An error that
                explains is worth more than one that apologises. */}
            <span>{status.data?.error ?? t('transcription.failed.noReason')}</span>
            <span>{t('transcription.failed.whatToDo')}</span>
          </span>
        }
        action={
          mayAsk && where !== undefined ? (
            // The disclosure is beside the retry and in the retry's own register: retrying sends
            // the audio again, which is a fact about the button next to it (§3.4).
            <EgressNotice
              destination={where}
              placement="retry"
              labels={egressLabels}
              action={
                <Button
                  variant="secondary"
                  disabled={asking}
                  onClick={() => {
                    transcribe.mutate();
                  }}
                >
                  {t('transcription.retry')}
                </Button>
              }
            />
          ) : (
            notice
          )
        }
      />
    );
  }

  return (
    <StateCard
      icon="align-left"
      dashed
      title={t('transcription.none.title')}
      body={
        <span style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <span>{t('transcription.none.body')}</span>
          {/* Before the request, not after it: that is the whole of principle 2 (§3.4). */}
          {notice}
        </span>
      }
      {...(mayAsk
        ? {
            action: (
              <Button
                variant="primary"
                disabled={asking}
                onClick={() => {
                  transcribe.mutate();
                }}
              >
                {t('transcription.none.action')}
              </Button>
            ),
          }
        : {})}
      {...(context.canEdit || !configured ? {} : { footnote: t('transcription.none.readOnly') })}
    />
  );
}

/**
 * How long it has been going, and whose queue it is in (`UI-15b`, `FBK-6`).
 *
 * Elapsed time from `started_at` and never a percentage, because nothing stores one. A queued job
 * has no `started_at`, and saying "started 0 minutes ago" for one that has not begun would be a
 * number standing in for a fact.
 *
 * **Written to the minute, and no finer.** A transcription at forty-three seconds and one at
 * forty-four are the same fact, so a counter that distinguished them would be a number moving on
 * screen for the sake of moving -- and it would need a render a second to stay honest. The first
 * minute says so in words rather than counting through it, because `Intl` has no phrase for "not
 * yet a minute" and "in 0 minutes" is not one either.
 */
function Running({
  status,
  provider,
  language,
}: {
  status: TranscriptionStatus | undefined;
  provider: string | undefined;
  language: string;
}) {
  const { t } = useTranslation('recording');
  // Nothing else re-renders this card while a job runs, so the elapsed time keeps its own time.
  const now = useNow();

  /** How long it has been going, to the minute. */
  const elapsedSince = (startedAt: string): string => {
    const started = Date.parse(startedAt);
    if (Number.isFinite(started) && now - started < MINUTE_MS) {
      return t('transcription.running.justStarted');
    }
    return t('transcription.running.since', { when: relative(startedAt, language, new Date(now)) });
  };

  if (status === undefined) return <>{t('transcription.running.working')}</>;

  const parts = [
    status.started_at === null
      ? t('transcription.running.queued')
      : elapsedSince(status.started_at),
    // The attempt only once it is past the first: "attempt 1 of 5" on every screen would be
    // noise, and "attempt 3" is the fact that explains why this is taking so long.
    status.attempts > 1
      ? t('transcription.running.attempt', { count: status.attempts })
      : undefined,
    provider === undefined ? undefined : t('transcription.running.provider', { provider }),
  ].filter((part): part is string => part !== undefined);

  return <>{parts.join(' · ')}</>;
}
