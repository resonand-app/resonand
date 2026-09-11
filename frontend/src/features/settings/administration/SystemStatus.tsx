/**
 * What this instance is and what it is holding (`INT-3e`, §V10).
 *
 * **The revision comparison is the loudest thing on the page when the two disagree.** That is not
 * emphasis for its own sake: a database at one revision under a build expecting another is an
 * instance where writes may fail or lose data until the migrations run, and the number is what
 * turns a bad upgrade from a mystery into a decision. So a mismatch is drawn first, in the failed
 * register, above everything else -- and when they agree it is one quiet row among the others,
 * because a banner that is always there is a banner nobody reads.
 *
 * Everything else here is facts in the mono column, which is the type rule for anything
 * comparable to another number: a version against the one in the release notes, bytes against a
 * disk, a count against last week.
 */

import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { KeyValueList, StateCard } from '@/design-system';
import type { KeyValueRow } from '@/design-system';
import { bytes, count, total } from '@/i18n/format';

import { AdminSection } from './AdminSection';
import { useSystemStatus } from './data';

export function SystemStatus() {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation();
  const status = useSystemStatus();

  if (status.isPending) {
    return (
      <AdminSection title={t('status.title')}>
        <StateCard icon="loader" title={t('status.loading')} />
      </AdminSection>
    );
  }

  if (status.data === undefined) {
    return (
      <AdminSection title={t('status.title')}>
        <StateCard
          icon="alert-circle"
          title={common('state.failed')}
          body={isApiProblem(status.error) ? status.error.detail : common('state.offline')}
        />
      </AdminSection>
    );
  }

  const { storage, database_revision: at, expected_revision: expected } = status.data;
  const mismatched = at !== expected;

  const rows: KeyValueRow[] = [
    { key: t('status.version'), value: status.data.version },
    { key: t('status.revision'), value: at ?? t('status.unknownRevision') },
    { key: t('status.recordings'), value: count(storage.recordings) },
    { key: t('status.trashed'), value: count(storage.trashed_recordings) },
    { key: t('status.libraries'), value: count(storage.libraries) },
    { key: t('status.duration'), value: total(storage.total_duration_ms) },
    { key: t('status.originals'), value: bytes(storage.originals_bytes) },
    { key: t('status.derived'), value: bytes(storage.derived_bytes) },
    { key: t('status.database'), value: bytes(storage.database_bytes) },
    {
      key: t('status.free'),
      value: storage.free_bytes === null ? t('status.unknownFree') : bytes(storage.free_bytes),
    },
    {
      key: t('status.retention'),
      value: t('status.days', { count: status.data.trash_retention_days }),
    },
  ];

  return (
    <AdminSection title={t('status.title')}>
      {mismatched && <RevisionMismatch at={at} expected={expected} />}
      <KeyValueList rows={rows} layout="inline" />
    </AdminSection>
  );
}

/**
 * The database is not where the build expects it.
 *
 * The one thing on this page that is drawn as an alarm, because it is the one thing that means
 * the instance may be losing data right now. It says both numbers, since which direction they
 * differ in is what tells an operator whether to run the migrations or roll the image back.
 */
function RevisionMismatch({ at, expected }: { at: string | null; expected: string | null }) {
  const { t } = useTranslation('settings');
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-panel)',
        border: '1px solid var(--state-failed)',
        background: 'var(--surface-2)',
      }}
    >
      <strong
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size)',
          fontWeight: 'var(--weight-semibold)',
          color: 'var(--state-failed)',
        }}
      >
        {t('status.mismatch.title')}
      </strong>
      <p
        style={{
          margin: 0,
          maxWidth: 520,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text)',
        }}
      >
        {t('status.mismatch.body')}
      </p>
      <KeyValueList
        rows={[
          { key: t('status.mismatch.at'), value: at ?? t('status.unknownRevision') },
          { key: t('status.mismatch.expected'), value: expected ?? t('status.unknownRevision') },
        ]}
        layout="inline"
      />
    </div>
  );
}
