/**
 * V1 · Sign in and first run (`UI-21a`, `UI-21b`, §V1).
 *
 * The one screen outside the shell: no nav, no sidebar, no player, because none of them mean
 * anything before there is a session. One panel, centred, with the mark above it.
 *
 * **The instance is named.** An instance is somebody's home server, and which one you are
 * handing a password to is the fact this screen exists to state. The `version` sits at the
 * bottom, quietly, where an operator can read it without it competing with the form.
 *
 * **There is no sign-up path, and nothing here implies one.** Registration is administrator-only
 * in v0, so the app kit's login screen -- which offers to create an account and puts a "No
 * account yet?" line under the panel -- is not copied forward. What is left is one path, drawn
 * as one path: the panel is a single column ending in the action, with no divider and no second
 * block. A second sign-in path later is a sibling added under the button; a divider drawn now
 * would be a rule with nothing on the other side of it.
 *
 * **Two faces, and the instance chooses which.** `needs_bootstrap` is true only while there are
 * no accounts at all, so the choice is a fact about the instance rather than about the person --
 * which is why the panel waits for `GET /instance` rather than drawing the form and swapping it.
 * Nothing is drawn in its place: the answer is one request away and a card that flashes empty is
 * worse than a beat of nothing (`RequireSession` settles the same question the same way).
 *
 * **Where somebody was going is remembered.** The guard puts it in the router's state
 * (`RequireSession`), so a link to a recording that bounced off the guard comes back to the
 * recording rather than to the landing page.
 */

import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { useBootstrap, useInstance, useSignIn } from '@/app/session';
import { Button, Logo, TextField } from '@/design-system';

import { intended } from './intended';

/** The mark at rest, which §V1 puts at 40px and more. */
const MARK_SIZE = 40;

/** The panel's width. Wider is a form that reads as a page; narrower crowds an email address. */
const PANEL_WIDTH = 380;

/**
 * The shortest password the instance will store.
 *
 * The backend's own minimum, written here because `GET /instance` does not carry it and a first
 * account refused after it has been typed is the worst moment to learn a rule. It is stated
 * before anything is typed, the way `UI-20b` states it for a password change.
 */
export const MINIMUM_PASSWORD_LENGTH = 10;

export function SignInView() {
  const { t } = useTranslation('signIn');
  const navigate = useNavigate();
  const location = useLocation();
  const instance = useInstance();

  function arrived() {
    void navigate(intended(location.state), { replace: true });
  }

  return (
    <Frame
      version={instance.data?.version}
      instanceName={
        instance.data === undefined ? undefined : t('on', { instance: instance.data.name })
      }
    >
      {instance.error !== null ? (
        <Unreachable
          onRetry={() => {
            void instance.refetch();
          }}
        />
      ) : instance.data === undefined ? null : instance.data.needs_bootstrap ? (
        <FirstRun onArrived={arrived} />
      ) : (
        <SignIn onArrived={arrived} />
      )}
    </Frame>
  );
}

/** Getting in: an address, a password, one action. */
function SignIn({ onArrived }: { onArrived: () => void }) {
  const { t } = useTranslation('signIn');
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    signIn.mutate({ email: email.trim(), password }, { onSuccess: onArrived });
  }

  return (
    <Form onSubmit={submit} title={t('title')}>
      <TextField
        label={t('email')}
        type="email"
        name="email"
        autoComplete="username"
        value={email}
        maxLength={320}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <TextField
        label={t('password')}
        type="password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />
      <Submit busy={signIn.isPending} disabled={email.trim() === '' || password === ''}>
        {signIn.isPending ? t('submitting') : t('submit')}
      </Submit>
      <Refusal error={signIn.error} />
    </Form>
  );
}

/**
 * The first run: the account that will run this instance (`UI-21b`, §V1).
 *
 * It says what it is doing rather than looking like a sign-up form that happens to work. The
 * account created here is the administrator -- it creates every other account by hand, because
 * v0 has no open registration -- and that is a sentence somebody should read before they type,
 * not a surprise they meet in the settings later.
 *
 * The endpoint refuses the moment any account exists, so this is not a second way in: it is the
 * one moment an instance has nobody to authorise a request.
 */
function FirstRun({ onArrived }: { onArrived: () => void }) {
  const { t } = useTranslation('signIn');
  const bootstrap = useBootstrap();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const ready =
    displayName.trim() !== '' && email.trim() !== '' && password.length >= MINIMUM_PASSWORD_LENGTH;

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    bootstrap.mutate(
      { email: email.trim(), password, display_name: displayName.trim() },
      { onSuccess: onArrived },
    );
  }

  return (
    <Form onSubmit={submit} title={t('firstRun.title')}>
      <Quiet>{t('firstRun.body')}</Quiet>
      <TextField
        label={t('firstRun.name')}
        name="name"
        autoComplete="name"
        value={displayName}
        maxLength={200}
        onChange={(event) => {
          setDisplayName(event.target.value);
        }}
      />
      <TextField
        label={t('email')}
        type="email"
        name="email"
        autoComplete="username"
        value={email}
        maxLength={320}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />
      <TextField
        label={t('password')}
        type="password"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />
      <Quiet>{t('firstRun.minimum', { count: MINIMUM_PASSWORD_LENGTH })}</Quiet>
      <Submit busy={bootstrap.isPending} disabled={!ready}>
        {bootstrap.isPending ? t('firstRun.submitting') : t('firstRun.submit')}
      </Submit>
      <Refusal error={bootstrap.error} />
    </Form>
  );
}

/** The panel's form: a heading and a column, which both faces are. */
function Form({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (event: SyntheticEvent) => void;
  children: ReactNode;
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-title-size)',
          fontWeight: 'var(--type-title-weight)',
          letterSpacing: 'var(--type-title-tracking)',
          color: 'var(--text)',
        }}
      >
        {title}
      </h1>
      {children}
    </form>
  );
}

/**
 * The one action, which is the same shape on both faces.
 *
 * **Submitting is the button's state and not the form's.** The fields hold what was typed and
 * stay editable, because a request that comes back refused leaves somebody one character from
 * being right -- clearing the form, or freezing it, would make them type the address again to
 * fix a password. What is prevented is a second request, which is what the disable is for.
 */
function Submit({
  busy,
  disabled,
  children,
}: {
  busy: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      variant="primary"
      type="submit"
      aria-busy={busy}
      disabled={disabled || busy}
      style={{ justifyContent: 'center', marginTop: 'var(--space-1)' }}
    >
      {children}
    </Button>
  );
}

/** A line that explains rather than labels: what this account is, what a password needs. */
function Quiet({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        lineHeight: 'var(--type-body-leading)',
        color: 'var(--text-3)',
        textWrap: 'pretty',
      }}
    >
      {children}
    </p>
  );
}

/**
 * Why the instance would not let somebody in (`UI-21c`, §V1).
 *
 * **The API's `detail`, shown rather than replaced**, which is what makes the three failures one
 * failure: an unknown address, a wrong password and a disabled account are answered with one
 * sentence on purpose, so that a sign-in form cannot be used to find out which addresses have
 * accounts here. The interface adds no branch of its own, and the test that walks all three and
 * compares the sentences is what keeps it that way.
 *
 * Two things do get a line of their own, because they are not that failure at all. Being rate
 * limited is a state somebody waits out rather than retypes, and the fact that is not in the
 * API's sentence is the one worth adding: the count is against the address, so a second device
 * is the same counter. An instance that never answered is already its own sentence -- the
 * client writes it when a request does not arrive -- and it must never read as a wrong password.
 *
 * A live region, because it appears in place after a press rather than on load: without one, a
 * screen reader announces nothing and the only feedback is a colour somebody cannot see.
 */
function Refusal({ error }: { error: unknown }) {
  const { t } = useTranslation('signIn');
  const problem = isApiProblem(error) ? error : undefined;
  if (problem === undefined) return null;

  return (
    <p
      role="alert"
      style={{
        margin: 0,
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--type-ui-size-sm)',
        lineHeight: 'var(--type-body-leading)',
        color: 'var(--danger)',
        textWrap: 'pretty',
      }}
    >
      {problem.detail}
      {problem.isRateLimited && <> {t('rateLimited')}</>}
    </p>
  );
}

/**
 * `GET /instance` itself did not answer (§V1).
 *
 * Its own state and not a failed sign-in: there is nothing to type here, and telling somebody
 * whose server is down that their password was wrong sends them to reset a password that works.
 * The panel is the message, because the form behind it could not be drawn honestly anyway --
 * which face this screen has is a fact only the instance has.
 */
function Unreachable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('signIn');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <h1
        style={{
          margin: 0,
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--type-title-size)',
          fontWeight: 'var(--type-title-weight)',
          letterSpacing: 'var(--type-title-tracking)',
          color: 'var(--text)',
        }}
      >
        {t('unreachable.title')}
      </h1>
      <Quiet>{t('common:state.offline')}</Quiet>
      <Button variant="secondary" onClick={onRetry} style={{ justifyContent: 'center' }}>
        {t('unreachable.retry')}
      </Button>
    </div>
  );
}

/**
 * The frame both faces share: the mark, one sentence, the panel, and what the instance is.
 *
 * Written once because a first run that drifted a few pixels from the sign-in screen would look
 * like a different product on the day somebody meets it for the first time.
 */
function Frame({
  children,
  instanceName,
  version,
}: {
  children: ReactNode;
  /** Which instance this is, once it has said. */
  instanceName: string | undefined;
  version: string | undefined;
}) {
  const { t } = useTranslation('signIn');
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          width: `min(${String(PANEL_WIDTH)}px, 100%)`,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Logo size={MARK_SIZE} />
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-ui-size)',
              lineHeight: 'var(--type-body-leading)',
              color: 'var(--text-3)',
              textWrap: 'pretty',
            }}
          >
            {t('tagline')}
          </p>
        </div>
        {children !== null && (
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-panel)',
              boxShadow: 'var(--elevation-panel)',
              padding: 'var(--space-6)',
            }}
          >
            {children}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            color: 'var(--text-3)',
          }}
        >
          {instanceName !== undefined && <span>{instanceName}</span>}
          {version !== undefined && <span>{t('version', { version })}</span>}
        </div>
      </div>
    </main>
  );
}
