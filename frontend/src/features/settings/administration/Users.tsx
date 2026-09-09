/**
 * The accounts on this instance (`INT-3b`, §V10).
 *
 * **One action per row, not two.** Whether an account is disabled is a fact the API now sends
 * (`API-20`), so the row draws the direction that applies rather than offering both and letting
 * one of them fail. Before that shape existed this list could not have been drawn honestly.
 *
 * **Deleting an account with content is refused, and the refusal has to read as a considered
 * position rather than as a bug.** The right answer is transferring their recordings first, which
 * is a later milestone -- so what the instance says is *why*, naming how many libraries and how
 * many recordings stand in the way, and what to do instead. That sentence is the API's own
 * (§1.9); repeating it here in different words would be two versions of one policy.
 *
 * **Registration is administrator-only in v0**, which is why creating an account is a form on
 * this page and there is no sign-up path anywhere in the product.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isApiProblem } from '@/api/problem';
import { Button, Chip, StateCard, Switch, TextField } from '@/design-system';
import { MINIMUM_PASSWORD_LENGTH } from '@/features/sign-in/SignInView';
import { instant } from '@/i18n/time';

import { AdminSection } from './AdminSection';
import { useUserActions, useUsers } from './data';
import type { AdminUser } from './data';

export function Users() {
  const { t } = useTranslation('settings');
  const { t: common } = useTranslation();
  const users = useUsers();
  const actions = useUserActions();

  return (
    <AdminSection title={t('users.title')} description={t('users.intro')}>
      {users.isPending && <StateCard icon="loader" title={t('users.loading')} />}
      {users.data !== undefined && (
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
          {users.data.map((user) => (
            <li key={user.id}>
              <UserRow user={user} actions={actions} />
            </li>
          ))}
        </ul>
      )}
      {actions.destroy.isError && (
        <p
          role="alert"
          style={{
            margin: 0,
            maxWidth: 520,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--state-failed)',
          }}
        >
          {/* The API's own sentence, with the numbers in it. It is a policy, not an error, and
              rewording it here would be a second copy of the policy. */}
          {isApiProblem(actions.destroy.error)
            ? actions.destroy.error.detail
            : common('state.offline')}
        </p>
      )}
      <NewAccount />
    </AdminSection>
  );
}

function UserRow({
  user,
  actions,
}: {
  user: AdminUser;
  actions: ReturnType<typeof useUserActions>;
}) {
  const { t } = useTranslation('settings');
  // The instant rather than a boolean, because "disabled since March" is a fact the row has
  // and "disabled" is a fact it does not (`API-20`).
  const disabledAt = user.disabled_at;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size)',
              color: disabledAt === null ? 'var(--text-1)' : 'var(--text-3)',
            }}
          >
            {user.display_name}
          </span>
          {user.is_admin && <Chip active>{t('users.administrator')}</Chip>}
          {disabledAt !== null && (
            <Chip>{t('users.disabledSince', { when: instant(disabledAt) })}</Chip>
          )}
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
            overflowWrap: 'anywhere',
          }}
        >
          {user.email}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        {/* One control showing the direction that applies, because the API says which state the
            account is in. Two buttons, one of which always fails, would be the older shape. */}
        <Button
          variant="secondary"
          onClick={() => {
            actions.setDisabled.mutate({ id: user.id, disabled: disabledAt === null });
          }}
        >
          {disabledAt === null ? t('users.disable') : t('users.enable')}
        </Button>
        <Button
          variant="danger"
          aria-label={t('users.deleteNamed', { name: user.display_name })}
          onClick={() => {
            actions.destroy.mutate(user.id);
          }}
        >
          {t('users.delete')}
        </Button>
      </div>
    </div>
  );
}

/** Accounts are made by hand, for people you know. There is no sign-up path anywhere. */
function NewAccount() {
  const { t } = useTranslation('settings');
  const { create } = useUserActions();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const ready =
    name.trim() !== '' && email.trim() !== '' && password.length >= MINIMUM_PASSWORD_LENGTH;

  if (!open) {
    return (
      <div>
        <Button
          variant="secondary"
          icon="plus"
          onClick={() => {
            setOpen(true);
          }}
        >
          {t('users.add')}
        </Button>
      </div>
    );
  }

  return (
    <form
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        maxWidth: 420,
        padding: 'var(--space-3)',
        borderRadius: 'var(--radius-card)',
        background: 'var(--surface-1)',
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        create.mutate(
          {
            display_name: name.trim(),
            email: email.trim(),
            password,
            is_admin: isAdmin,
          },
          {
            onSuccess: () => {
              setName('');
              setEmail('');
              setPassword('');
              setIsAdmin(false);
              setOpen(false);
            },
          },
        );
      }}
    >
      <TextField
        label={t('users.name')}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <TextField
        type="email"
        label={t('users.email')}
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <TextField
        type="password"
        autoComplete="new-password"
        label={t('users.password')}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-ui-size-sm)',
          color: 'var(--text-3)',
        }}
      >
        {t('account.minimum', { count: MINIMUM_PASSWORD_LENGTH })}
      </span>
      <Switch
        checked={isAdmin}
        onChange={setIsAdmin}
        label={t('users.makeAdmin')}
        description={t('users.makeAdminHint')}
      />
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <Button type="submit" variant="primary" disabled={!ready || create.isPending}>
          {t('users.create')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setOpen(false);
          }}
        >
          {t('users.cancel')}
        </Button>
      </div>
      {create.isError && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--state-failed)',
          }}
        >
          {isApiProblem(create.error) ? create.error.detail : t('users.createFailed')}
        </p>
      )}
    </form>
  );
}
