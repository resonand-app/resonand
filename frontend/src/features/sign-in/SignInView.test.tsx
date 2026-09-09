/**
 * V1 · Getting in, and the screen that must not offer a way to sign up (`UI-21a`, §V1).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { CARRER_NOU, NOBODY, PASSWORD, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { intended } from './intended';
import { SignInView } from './SignInView';

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
  await userEvent.type(screen.getByLabelText('Email'), email);
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

  it('will not submit an empty form, so a blank press cannot spend an attempt', () => {
    show();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
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
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('where signing in leads', () => {
  it('returns to the link somebody followed rather than to the landing page', async () => {
    show(toRecording(CARRER_NOU));
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
    expect(intended({ from: '/search?q=vermut' })).toBe('/search?q=vermut');
  });
});
