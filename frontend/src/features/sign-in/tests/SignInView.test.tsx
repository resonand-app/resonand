/**
 * V1 · Getting in, the screen that must not offer a way to sign up, the first run, and the four
 * states (`UI-21a`, `UI-21b`, `UI-21c`, §V1).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { post } from '@/api/client';
import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import {
  FIELD_TAKE,
  LOGIN_ATTEMPTS_PER_MINUTE,
  SAM,
  NOBODY,
  PASSWORD,
  archive,
} from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { intended } from '../intended';
import { MINIMUM_PASSWORD_LENGTH, SignInView } from '../SignInView';

mockApi();

/** Where the router ended up, so a test can assert on where signing in led. */
function Whereabouts() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

/** The screen, at `/sign-in`, optionally arrived at from somewhere the guard defended. */
function show(from?: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[{ pathname: routes.signIn, ...(from ? { state: { from } } : {}) }]}
      >
        <Whereabouts />
        <Routes>
          <Route path={routes.signIn} element={<SignInView />} />
          <Route path={routes.libraries} element={<div>the landing</div>} />
          <Route path={routes.recording} element={<div>the recording</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function signIn(email: string, password: string) {
  // The panel waits for `GET /instance` to say which face this screen has, so every one of
  // these starts by waiting for the form rather than for a render.
  await userEvent.type(await screen.findByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('getting in', () => {
  it('exchanges an address and a password for a session, and leaves', async () => {
    show();
    await signIn(archive.me.email, PASSWORD);
    expect(await screen.findByText('the landing')).toBeVisible();
  });

  it('says which instance this is, because handing a password to one matters', async () => {
    show();
    expect(await screen.findByText(/sonarium/)).toBeVisible();
    expect(await screen.findByText(/0\.1\.0/)).toBeVisible();
  });

  it('shows what the instance said when it refused', async () => {
    show();
    await signIn(NOBODY, PASSWORD);
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match an account/i);
  });

  it('will not submit an empty form, so a blank press cannot spend an attempt', async () => {
    show();
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('reveals a typed password without submitting the form', async () => {
    show();
    const password: HTMLInputElement = await screen.findByLabelText('Password');
    await userEvent.type(password, PASSWORD);
    expect(password.type).toBe('password');

    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.type).toBe('text');
    expect(password.value).toBe(PASSWORD);

    await userEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password.type).toBe('password');
  });
});

describe('there is no way to make an account here', () => {
  it('offers no sign-up path of any kind', async () => {
    show();
    await screen.findByRole('heading', { name: 'Sign in' });
    // The app kit's login screen offers to create one; registration is administrator-only in
    // v0, so none of its wording is copied forward and there is nothing else to press.
    expect(screen.queryByText(/create/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/account yet/i)).not.toBeInTheDocument();
    // The password field's reveal toggle is the other button here -- it is part of the one
    // field, not a second path through the screen.
    expect(screen.getByRole('button', { name: 'Show password' })).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

describe('where signing in leads', () => {
  it('returns to the link somebody followed rather than to the landing page', async () => {
    show(toRecording(FIELD_TAKE));
    await signIn(archive.me.email, PASSWORD);
    expect(await screen.findByText('the recording')).toBeVisible();
  });

  it('goes to the landing page when nothing was being defended', () => {
    expect(intended(null)).toBe(routes.libraries);
    expect(intended({})).toBe(routes.libraries);
    expect(intended({ from: routes.signIn })).toBe(routes.libraries);
  });

  it('honours only a path on this instance, so a stored `from` cannot send somebody away', () => {
    // Router state is whatever the last navigation put there. A `from` carrying a host would be
    // an open redirect written by whoever last linked to this screen.
    expect(intended({ from: '//evil.example' })).toBe(routes.libraries);
    expect(intended({ from: 'https://evil.example' })).toBe(routes.libraries);
    expect(intended({ from: '/search?q=rehearsal' })).toBe('/search?q=rehearsal');
  });
});

describe('the first run', () => {
  /** An instance with nobody on it yet, which is the only thing that shows the other face. */
  function empty() {
    archive.instance = { ...archive.instance, needs_bootstrap: true };
  }

  it('creates the first account and says it is the administrator', async () => {
    empty();
    show();
    expect(await screen.findByRole('heading', { name: 'Create the first account' })).toBeVisible();
    expect(screen.getByText(/will be the administrator/i)).toBeVisible();

    await userEvent.type(screen.getByLabelText('Display name'), 'Alex Morgan');
    await userEvent.type(screen.getByLabelText('Email'), 'alex@example.test');
    await userEvent.type(screen.getByLabelText('Password'), PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: 'Create the account' }));

    expect(await screen.findByText('the landing')).toBeVisible();
    expect(archive.instance.needs_bootstrap).toBe(false);
  });

  it('states the password minimum before anything is typed', async () => {
    empty();
    show();
    expect(await screen.findByText(/at least 10 characters/i)).toBeVisible();
  });

  it('will not send a password the instance would refuse', async () => {
    empty();
    show();
    await screen.findByRole('heading', { name: 'Create the first account' });
    await userEvent.type(screen.getByLabelText('Display name'), 'Alex Morgan');
    await userEvent.type(screen.getByLabelText('Email'), 'alex@example.test');
    await userEvent.type(
      screen.getByLabelText('Password'),
      'a'.repeat(MINIMUM_PASSWORD_LENGTH - 1),
    );
    expect(screen.getByRole('button', { name: 'Create the account' })).toBeDisabled();
  });

  it('is not on the screen once the instance has an account', async () => {
    show();
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
  });

  it('draws no panel at all until the instance has said which face this is', () => {
    // Not a spinner and not the sign-in form: which face this screen has is a fact about the
    // instance, and a form that swapped itself out a moment later is one somebody types into.
    show();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

describe('the four states', () => {
  it('is busy while the instance decides, and the fields hold what was typed', async () => {
    server.use(http.post('/api/auth/session', () => new Promise(() => undefined)));
    show();
    await signIn(archive.me.email, PASSWORD);

    const action = screen.getByRole('button', { name: 'Signing in' });
    expect(action).toHaveAttribute('aria-busy', 'true');
    expect(action).toBeDisabled();
    // A refused answer leaves somebody one character from being right, so the fields are not
    // cleared and not frozen -- only a second request is prevented.
    expect(screen.getByLabelText('Email')).toHaveValue(archive.me.email);
    expect(screen.getByLabelText('Password')).toBeEnabled();
  });

  it('answers an unknown address, a wrong password and a disabled account with one string', async () => {
    // The test `UI-21c` asks for. A sign-in form that answered these three differently would be
    // a way to find out which addresses have accounts on somebody's instance, which is why the
    // API sends one sentence and the interface adds no branch of its own.
    const said: string[] = [];
    const refused: [address: string, password: string][] = [
      [NOBODY, PASSWORD],
      [archive.me.email, 'not-the-password'],
      [SAM.email, PASSWORD],
    ];
    for (const [address, password] of refused) {
      const { unmount } = show();
      await signIn(address, password);
      said.push((await screen.findByRole('alert')).textContent);
      unmount();
    }
    expect(new Set(said).size).toBe(1);
    expect(said[0]).toMatch(/do not match an account/i);
    // And it names none of the three situations it is standing in for.
    expect(said[0]?.toLowerCase()).not.toMatch(/disabled|unknown|no such|exist/);
  });

  it('says being rate limited is a wait, and that the count is against the address', async () => {
    const address = archive.me.email;
    for (let attempt = 0; attempt < LOGIN_ATTEMPTS_PER_MINUTE; attempt += 1) {
      await post('/api/auth/session', {
        body: { email: address, password: 'not-the-password' },
      }).catch(() => undefined);
    }
    show();
    await signIn(address, PASSWORD);

    const said = await screen.findByRole('alert');
    expect(said).toHaveTextContent(/too many sign-in attempts/i);
    // The fact the API's sentence does not carry: a second device is the same counter.
    expect(said).toHaveTextContent(/per email address/i);
  });

  it('says the instance is not answering, and never that a password was wrong', async () => {
    server.use(http.get('/api/instance', () => HttpResponse.error()));
    show();

    expect(await screen.findByRole('heading', { name: /not answering/i })).toBeVisible();
    // Nothing to type: sending somebody whose server is down to check their password sends them
    // to reset one that works.
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(document.body.textContent.toLowerCase()).not.toContain('password');

    server.resetHandlers();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeVisible();
  });
});
