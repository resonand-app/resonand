/**
 * V10 · Sessions (`UI-20c`, §V10).
 *
 * The list exists for one moment: somebody scrolling it and not recognising a line. Everything
 * here is arranged around making that moment readable and the next click safe.
 *
 * **The current session is marked and is not revocable by mistake.** Signing yourself out of the
 * device you are holding is a legitimate thing to want and it is what the profile menu is for; it
 * is not what somebody clicking down a list of devices means. So this row carries the badge and
 * no button, rather than a button that asks whether you are sure.
 *
 * **"Sign out everywhere else" is absent when there is nowhere else**, not disabled. A control
 * that can never do anything is one `UI-34c` says not to draw -- and a greyed-out button here
 * would suggest there are other sessions and something is stopping you.
 *
 * **An unrecognised device shows its raw user agent.** Guessing "Chrome on a Mac" from a string
 * and getting it wrong is worse than the string: the whole value of this screen is somebody
 * recognising, or failing to recognise, a line. The product does not put a guess in the way.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { relative } from '@/i18n/time';
import { Button, Chip, Dialog, Modal, StateCard } from '@/design-system';

import { useSessionRevocations, useSessions } from './data';
import type { SessionSummary } from './data';

export function SessionsPanel() {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation();
  const sessions = useSessions();
  const revoke = useSessionRevocations();
  const [confirming, setConfirming] = useState(false);

  if (sessions.isPending) {
    return <StateCard icon="loader" title={t('sessions.loading')} />;
  }
  if (sessions.data === undefined) {
    return (
      <StateCard
        icon="alert-circle"
        title={common('state.failed')}
        body={t('sessions.error')}
        action={
          <Button
            variant="secondary"
            onClick={() => {
              void sessions.refetch();
            }}
          >
            {common('action.retry')}
          </Button>
        }
      />
    );
  }

  const others = sessions.data.filter((one) => !one.is_current);

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-1)',
          }}
        >
          {t('sessions.title')}
        </h2>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {t('sessions.intro')}
        </p>
      </div>
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
        {sessions.data.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onRevoke={() => {
              revoke.one.mutate(session.id);
            }}
          />
        ))}
      </ul>
      {others.length > 0 && (
        <div>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirming(true);
            }}
          >
            {t('sessions.revokeOthers')}
          </Button>
        </div>
      )}
      <Modal
        open={confirming}
        onClose={() => {
          setConfirming(false);
        }}
      >
        <Dialog
          title={t('sessions.revokeOthersConfirm')}
          description={t('sessions.revokeOthersBody', { count: others.length })}
          labels={{ close: common('action.close') }}
          onClose={() => {
            setConfirming(false);
          }}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirming(false);
                }}
              >
                {common('action.cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={revoke.others.isPending}
                onClick={() => {
                  revoke.others.mutate(undefined, {
                    onSuccess: () => {
                      setConfirming(false);
                    },
                  });
                }}
              >
                {t('sessions.revokeOthers')}
              </Button>
            </>
          }
        />
      </Modal>
    </section>
  );
}

function SessionRow({ session, onRevoke }: { session: SessionSummary; onRevoke: () => void }) {
  const { t } = useTranslation('settings');
  // The raw string, or the honest admission that there is not one. A guess about an unknown
  // device would be the one thing that makes this list unreadable when it matters.
  const device = session.user_agent ?? t('sessions.unknownDevice');

  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-2)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--text-1)',
              overflowWrap: 'anywhere',
            }}
          >
            {device}
          </span>
          {session.is_current && <Chip active>{t('sessions.current')}</Chip>}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {t('sessions.lastSeen', { when: relative(session.last_seen_at) })}
          {session.ip === null ? '' : ` · ${session.ip}`}
        </span>
      </div>
      {/* No button on this row at all, rather than a disabled one: signing out of the device you
          are holding is what the profile menu is for, and it is not what clicking down a list of
          devices means. */}
      {!session.is_current && (
        <Button
          variant="ghost"
          aria-label={t('sessions.revokeNamed', { device })}
          onClick={onRevoke}
        >
          {t('sessions.revoke')}
        </Button>
      )}
    </li>
  );
}
