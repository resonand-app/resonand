/**
 * V10 · Account (`UI-20b`, §V10).
 *
 * Two things, and they are not the same kind of thing. Your name and your address are facts you
 * correct, so they save on blur the way the metadata panel does (`UI-34l`) -- a settings screen
 * with a Save button at the bottom is a screen somebody leaves without pressing it. A password is
 * not a correction: it needs the one you have now, it ends every other session, and it is a form
 * with an action, drawn as one.
 *
 * **The ten-character minimum is stated before anything is typed**, not after it is rejected. It
 * is the backend's own rule (`ChangePassword`), and a rule learned by failing is a rule the
 * product could have told you.
 *
 * **There are no avatar images.** No storage exists for one and fetching one from an external
 * service would violate principle 2, so identity is the mark and initials -- and the panel says
 * so rather than leaving an empty circle that reads as a picture that failed to load.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { initialsOf } from '@/app/destinations';
import { useSession } from '@/app/session';
import { Button, InlineField, Logo, TextField } from '@/design-system';
import { MINIMUM_PASSWORD_LENGTH } from '@/features/sign-in/SignInView';

import { useChangePassword, useUpdateAccount } from './data';

/** The avatar tile, at the size §V10's identity row draws it. */
const MARK_SIZE = 40;

export function AccountPanel() {
  const { t } = useTranslation('settings');
  const { account } = useSession();
  const update = useUpdateAccount();

  if (account === undefined) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <Heading>{t('account.identity')}</Heading>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span
            aria-hidden
            style={{
              display: 'grid',
              placeItems: 'center',
              width: MARK_SIZE,
              height: MARK_SIZE,
              flex: '0 0 auto',
              borderRadius: 'var(--radius-chip)',
              background: 'var(--surface-2)',
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-2)',
            }}
          >
            {initialsOf(account.display_name) || <Logo size={MARK_SIZE / 2} />}
          </span>
          <Quiet>{t('account.noAvatar')}</Quiet>
        </div>
        <InlineField
          label={t('account.displayName')}
          value={account.display_name}
          onSave={(name) => {
            const trimmed = name.trim();
            if (trimmed === '' || trimmed === account.display_name) return;
            update.mutate({ display_name: trimmed });
          }}
        />
        <InlineField
          label={t('account.email')}
          value={account.email}
          onSave={(email) => {
            const trimmed = email.trim();
            if (trimmed === '' || trimmed === account.email) return;
            update.mutate({ email: trimmed });
          }}
        />
        {/* The address is the one field here that can be refused -- somebody else already has it
            -- and a save-on-blur field with nowhere to say so would swallow it (§1.9). */}
        {update.isError && <Failure error={update.error} />}
      </section>
      <PasswordSection />
    </div>
  );
}

/**
 * Changing the password.
 *
 * Its own form with its own action, because it is the one thing on this screen that is not a
 * correction: it needs the password you have now, and succeeding ends every other session. That
 * consequence is stated **before** the button rather than in the confirmation afterwards.
 */
function PasswordSection() {
  const { t } = useTranslation('settings');
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const tooShort = next !== '' && next.length < MINIMUM_PASSWORD_LENGTH;

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <Heading>{t('account.password')}</Heading>
        <Quiet>{t('account.passwordIntro')}</Quiet>
      </div>
      <form
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
        onSubmit={(event) => {
          event.preventDefault();
          if (current === '' || next.length < MINIMUM_PASSWORD_LENGTH) return;
          change.mutate(
            { current_password: current, new_password: next },
            {
              onSuccess: () => {
                setCurrent('');
                setNext('');
              },
            },
          );
        }}
      >
        <TextField
          type="password"
          autoComplete="current-password"
          label={t('account.currentPassword')}
          value={current}
          onChange={(event) => {
            setCurrent(event.target.value);
          }}
        />
        <TextField
          type="password"
          autoComplete="new-password"
          label={t('account.newPassword')}
          value={next}
          minLength={MINIMUM_PASSWORD_LENGTH}
          // The rule is stated as help before anything is typed, and only becomes an error once
          // there is something too short to be one.
          error={tooShort ? t('account.minimum', { count: MINIMUM_PASSWORD_LENGTH }) : undefined}
          onChange={(event) => {
            setNext(event.target.value);
          }}
        />
        {!tooShort && <Quiet>{t('account.minimum', { count: MINIMUM_PASSWORD_LENGTH })}</Quiet>}
        <div>
          <Button
            type="submit"
            variant="primary"
            disabled={current === '' || next.length < MINIMUM_PASSWORD_LENGTH || change.isPending}
          >
            {t('account.change')}
          </Button>
        </div>
        {change.isError && <Failure error={change.error} />}
        {change.isSuccess && (
          <p
            role="status"
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size-sm)',
              color: 'var(--state-done)',
            }}
          >
            {t('account.changed')}
          </p>
        )}
      </form>
    </section>
  );
}

/** What the instance said, in its own words (§1.9). */
function Failure({ error }: { error: unknown }) {
  const { t } = useTranslation();
  return (
    <p
      role="alert"
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        color: 'var(--state-failed)',
      }}
    >
      {isApiProblem(error) ? error.detail : t('state.offline')}
    </p>
  );
}

function Heading({ children }: { children: string }) {
  return (
    <h2
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size)',
        fontWeight: 'var(--weight-semibold)',
        color: 'var(--text-1)',
      }}
    >
      {children}
    </h2>
  );
}

function Quiet({ children }: { children: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        color: 'var(--text-3)',
      }}
    >
      {children}
    </p>
  );
}
