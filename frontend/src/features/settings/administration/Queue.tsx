/**
 * The job queue (`INT-3d`, §V10).
 *
 * **An empty queue is the healthy case and should look healthy rather than empty.** Everything
 * that was asked for has been done, which is the state an operator wants to find -- so it reads
 * as that rather than as a list with nothing in it.
 *
 * **Four hundred pending jobs after a bulk import is also healthy**, and drawing four hundred
 * rows would bury the one that matters. So the panel leads with the counts and then draws the
 * newest five, because what somebody needs from a long queue is whether it is moving and
 * whether anything failed -- not a row per file. "Show more" is there for the morning when the
 * fifth row is not far enough back, and it is the only way the list gets long.
 *
 * **`ready_at` is rendered as when the next attempt happens.** It is what a backoff looks like
 * from outside, and hiding it turns "waiting four minutes" into "stuck". Together with `attempts`
 * it is the difference between a queue that is retrying and a queue that has given up.
 *
 * **The error is the real text.** Not a category, not "something went wrong" -- the message the
 * job actually recorded, because the person reading this page is the person who can act on it.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { Button, Chip, KeyValueList, StateCard } from '@/design-system';
import type { KeyValueRow } from '@/design-system';
import { count } from '@/i18n/format';
import { instant, relative } from '@/i18n/time';

import { AdminSection } from './AdminSection';
import { QUEUE_ROWS, useJobActions, useQueue, useQueueCounts } from './data';
import type { JobActions } from './data';

/** The states the API reports, in the order an operator cares about them. */
const STATES = ['failed', 'running', 'pending', 'done', 'cancelled'] as const;

export function Queue() {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation();
  const [state, setState] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);
  const limit = expanded ? QUEUE_ROWS.expanded : QUEUE_ROWS.default;
  const queue = useQueue(state, limit);
  const actions = useJobActions();
  // Their own endpoint rather than the instance's status, because they move with the rows and
  // that one measures the disk to answer (`FBK-4`).
  const counts = useQueueCounts().data;

  return (
    <AdminSection title={t('queue.title')} description={t('queue.intro')}>
      {counts !== undefined && <Counts counts={counts} />}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Chip
          as="button"
          active={state === undefined}
          onClick={() => {
            setState(undefined);
            setExpanded(false);
          }}
        >
          {t('queue.all')}
        </Chip>
        {STATES.map((one) => (
          <Chip
            key={one}
            as="button"
            active={state === one}
            onClick={() => {
              setState(one);
              setExpanded(false);
            }}
          >
            {t(`queue.state.${one}`)}
          </Chip>
        ))}
      </div>
      <Rows
        queue={queue}
        actions={actions}
        shown={limit}
        onShowMore={
          expanded
            ? undefined
            : () => {
                setExpanded(true);
              }
        }
      />
      {queue.error !== null && queue.error !== undefined && (
        <StateCard
          icon="alert-circle"
          title={common('state.failed')}
          body={isApiProblem(queue.error) ? queue.error.detail : common('state.offline')}
        />
      )}
    </AdminSection>
  );
}

/**
 * The counts by state, which is what a long queue is actually asking.
 *
 * Drawn whether the queue is long or short: on a quiet instance it is four zeroes and a done
 * count, which reads as healthy, and on a busy one it is the answer that four hundred rows
 * would have hidden.
 */
function Counts({ counts }: { counts: Record<string, number> }) {
  const { t } = useTranslation('settings');
  const rows: KeyValueRow[] = STATES.map((one) => ({
    key: t(`queue.state.${one}`),
    value: count(counts[one] ?? 0),
  }));
  return <KeyValueList rows={rows} layout="inline" />;
}

function Rows({
  queue,
  actions,
  shown,
  onShowMore,
}: {
  queue: ReturnType<typeof useQueue>;
  actions: JobActions;
  shown: number;
  /** Absent once the list is already as long as it goes, which is when the button would lie. */
  onShowMore?: (() => void) | undefined;
}) {
  const { t } = useTranslation('settings');

  if (queue.isPending) return <StateCard icon="loader" title={t('queue.loading')} />;

  if (queue.total === 0) {
    /* The healthy case, and it says so. Everything asked for has been done. */
    return <StateCard icon="check" title={t('queue.empty.title')} body={t('queue.empty.body')} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {queue.total > shown && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
            }}
          >
            {/* The counts above are the answer for a long queue; these rows are the newest few. */}
            {t('queue.tooMany', { shown, total: count(queue.total) })}
          </p>
          {onShowMore !== undefined && (
            <Button variant="secondary" onClick={onShowMore}>
              {t('queue.showMore', { n: QUEUE_ROWS.expanded })}
            </Button>
          )}
        </div>
      )}
      <ul
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {queue.jobs.map((job) => (
          <li key={job.id}>
            <JobRow job={job} actions={actions} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function JobRow({
  job,
  actions,
}: {
  job: ReturnType<typeof useQueue>['jobs'][number];
  actions: JobActions;
}) {
  const { t } = useTranslation('settings');
  const isOver = job.state === 'done' || job.state === 'cancelled';
  // What a backoff looks like from outside. A pending job whose `ready_at` is in the future is
  // waiting on purpose, and saying when turns "stuck" back into "retrying".
  const waitingUntil =
    job.ready_at !== null && job.state === 'pending' && new Date(job.ready_at) > new Date()
      ? job.ready_at
      : null;

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-overline-size)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--type-overline-tracking)',
              color: 'var(--text-3)',
            }}
          >
            {job.kind}
          </span>
          <Chip active={job.state === 'failed'}>{t(`queue.state.${job.state}`)}</Chip>
          {job.attempts > 1 && <Chip>{t('queue.attempts', { count: job.attempts })}</Chip>}
        </div>
        {job.audio_uuid !== null && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-3)',
              overflowWrap: 'anywhere',
            }}
          >
            {job.audio_uuid}
          </span>
        )}
        {waitingUntil !== null && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-2)',
            }}
          >
            {t('queue.nextAttempt', { when: relative(waitingUntil) })}
          </span>
        )}
        {job.error !== null && job.error !== '' && (
          /* The message the job recorded, not a category. The person reading this is the person
             who can do something about it. */
          <span
            style={{
              maxWidth: 520,
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--state-failed)',
              overflowWrap: 'anywhere',
            }}
          >
            {job.error}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {instant(job.created_at)}
        </span>
      </div>
      {/* An action that can never apply is absent rather than disabled (`UI-34c`): a finished job
          has nothing to retry into and nothing to cancel. */}
      {!isOver && (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <Button
            variant="secondary"
            aria-label={t('queue.retryNamed', { kind: job.kind, id: job.id })}
            onClick={() => {
              actions.retry.mutate(job.id);
            }}
          >
            {t('queue.retry')}
          </Button>
          <Button
            variant="ghost"
            aria-label={t('queue.cancelNamed', { kind: job.kind, id: job.id })}
            onClick={() => {
              actions.cancel.mutate(job.id);
            }}
          >
            {t('queue.cancel')}
          </Button>
        </div>
      )}
    </div>
  );
}
