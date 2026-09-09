/**
 * V1 · Sign in (`UI-21a`, §V1).
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
 * **Where somebody was going is remembered.** The guard puts it in the router's state
 * (`RequireSession`), so a link to a recording that bounced off the guard comes back to the
 * recording rather than to the landing page.
 */

import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';

import { isApiProblem } from '@/api/problem';
import { useInstance, useSignIn } from '@/app/session';
import { Button, Logo, TextField } from '@/design-system';

import { intended } from './intended';

/** The mark at rest, which §V1 puts at 40px and more. */
const MARK_SIZE = 40;

/** The panel's width. Wider is a form that reads as a page; narrower crowds an email address. */
const PANEL_WIDTH = 380;

export function SignInView() {
  const { t } = useTranslation('signIn');
  const navigate = useNavigate();
  const location = useLocation();
  const instance = useInstance();
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // The API's own `detail`, shown rather than replaced (§1.9). `UI-21c` is where the four states
  // this can be become four states rather than one line.
  const refusal = isApiProblem(signIn.error) ? signIn.error.detail : undefined;

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    signIn.mutate(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          void navigate(intended(location.state), { replace: true });
        },
      },
    );
  }

  return (
    <Panel
      version={instance.data?.version}
      footer={instance.data === undefined ? undefined : t('on', { instance: instance.data.name })}
    >
      <form
        onSubmit={submit}
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
          {t('title')}
        </h1>
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
        <Button
          variant="primary"
          type="submit"
          disabled={email.trim() === '' || password === ''}
          style={{ justifyContent: 'center', marginTop: 'var(--space-1)' }}
        >
          {t('submit')}
        </Button>
        {refusal !== undefined && <Refusal>{refusal}</Refusal>}
      </form>
    </Panel>
  );
}

/**
 * Why the instance would not let somebody in.
 *
 * A live region, because it appears in place after a press rather than on load: without one, a
 * screen reader announces nothing and the only feedback is a colour somebody cannot see.
 */
function Refusal({ children }: { children: ReactNode }) {
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
      {children}
    </p>
  );
}

/**
 * The frame every face of this screen shares: the mark, one sentence, the panel, the version.
 *
 * Written once because `UI-21b` puts a second face inside it, and a first run that drifted a few
 * pixels from the sign-in screen would look like a different product on the day somebody meets
 * it for the first time.
 */
function Panel({
  children,
  footer,
  version,
}: {
  children: ReactNode;
  /** Which instance this is, once it has said. */
  footer: string | undefined;
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
          {footer !== undefined && <span>{footer}</span>}
          {version !== undefined && <span>{t('version', { version })}</span>}
        </div>
      </div>
    </main>
  );
}
