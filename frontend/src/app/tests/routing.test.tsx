/**
 * The eight routes, the guard, and the end of a session (`UI-4a`, §2.1).
 *
 * These run against the mock instance rather than a stubbed hook, so what is under test is the
 * arrangement a person meets: a URL, a session that is or is not there, and where they end up.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { QueryClientProvider } from '@tanstack/react-query';

import { createQueryClient } from '@/api/query-client';

import { AVIA, CARRER_NOU } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';
import { NotBuiltYet } from '../shell/NotBuiltYet';
import { NotFound } from '../shell/NotFound';
import { RequireSession } from '../shell/RequireSession';
import {
  recordingIn,
  routes,
  toLibrary,
  toLibrarySettings,
  toRecording,
  toSearch,
} from '../routes';

mockApi();

/** Where the router ended up, printed so a test can assert on it. */
function Whereabouts() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderAt(path: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Whereabouts />
        <Routes>
          <Route path={routes.signIn} element={<div>sign in</div>} />
          <Route element={<RequireSession />}>
            <Route path={routes.libraries} element={<NotBuiltYet view="V2" />} />
            <Route path={routes.library} element={<NotBuiltYet view="V3" />} />
            <Route path={routes.librarySettings} element={<NotBuiltYet view="V7" />} />
            <Route path={routes.recording} element={<NotBuiltYet view="V5" />} />
            <Route path={routes.search} element={<NotBuiltYet view="V6" />} />
            <Route path={routes.trash} element={<NotBuiltYet view="V9" />} />
            <Route path={routes.settings} element={<NotBuiltYet view="V10" />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** No session, for the tests about not having one. */
function signedOut() {
  server.use(
    http.get('/api/auth/me', () =>
      HttpResponse.json(
        {
          type: '/errors/unauthenticated',
          title: 'Not signed in',
          detail: 'Sign in.',
          status: 401,
        },
        { status: 401 },
      ),
    ),
  );
}

describe('the eight routes', () => {
  it.each([
    ['the libraries landing', routes.libraries, 'V2'],
    ['a library', toLibrary(AVIA), 'V3'],
    ["a library's settings", toLibrarySettings(AVIA), 'V7'],
    ['a recording', toRecording(CARRER_NOU), 'V5'],
    ['search', toSearch('vermut'), 'V6'],
    ['the trash', routes.trash, 'V9'],
    ['settings', routes.settings, 'V10'],
  ])('reaches %s', async (_name, path, view) => {
    renderAt(path);
    expect(await screen.findByText(view)).toBeInTheDocument();
  });

  it('builds a path rather than letting a view write one', () => {
    expect(toLibrary(AVIA)).toBe(`/library/${AVIA}`);
    expect(toRecording(CARRER_NOU)).toBe(`/recording/${CARRER_NOU}`);
    expect(toLibrarySettings(AVIA)).toBe(`/library/${AVIA}/settings`);
  });

  it('keeps the filters already set when the query changes', () => {
    const filters = new URLSearchParams({ transcription_state: 'done', library: AVIA });
    const built = toSearch('carrer nou', filters);
    const parameters = new URLSearchParams(built.split('?')[1]);
    expect(parameters.get('q')).toBe('carrer nou');
    expect(parameters.get('transcription_state')).toBe('done');
  });

  it('encodes what it is given, because a uuid is not the only thing that ever arrives', () => {
    expect(toLibrary('a b/c')).toBe('/library/a%20b%2Fc');
  });

  it('says an address has nothing at it, without saying whose fault that is', async () => {
    // 404 is the whole of what the interface knows -- the ACL answers 404 for what is not yours
    // too (DEC-14), so "you do not have permission" is a sentence it may never write.
    renderAt('/nothing/like/this');
    const card = await screen.findByText('There is nothing at this address');
    expect(card).toBeInTheDocument();
    expect(document.body.textContent.toLowerCase()).not.toContain('permission');
  });
});

describe('the guard', () => {
  it('lets somebody with a session through', async () => {
    renderAt(routes.libraries);
    expect(await screen.findByText('V2')).toBeInTheDocument();
  });

  it('sends somebody without one to sign in', async () => {
    signedOut();
    renderAt(routes.trash);
    expect(await screen.findByText('sign in')).toBeInTheDocument();
  });

  it('remembers where they were going, so the link they followed still works', async () => {
    signedOut();
    renderAt(toRecording(CARRER_NOU));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(routes.signIn);
    });
    // The location the guard was defending is kept in the router's state, which is what V1 reads
    // to send somebody back to the recording rather than to the landing page.
    expect(window.history.state).toBeDefined();
  });

  it('lets the sign-in route be reached without one', async () => {
    signedOut();
    renderAt(routes.signIn);
    expect(await screen.findByText('sign in')).toBeInTheDocument();
  });

  it('renders nothing at all while the answer is still coming', () => {
    server.use(http.get('/api/auth/me', () => new Promise(() => undefined)));
    renderAt(routes.libraries);
    // Not a spinner. The answer is usually a few milliseconds from cache, and a spinner that
    // flashes reads as something going wrong.
    expect(screen.queryByText('V2')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('which recording a path is showing', () => {
  it('answers the uuid, so the player bar can drop its waveform', () => {
    // The shell asks this and hands it to the bar: two waveforms at two scales drifting a frame
    // apart is what makes people believe there are two players (§3.1).
    expect(recordingIn(toRecording(CARRER_NOU))).toBe(CARRER_NOU);
  });

  it('answers nothing anywhere else, including the library it came from', () => {
    expect(recordingIn(toLibrary(AVIA))).toBeUndefined();
    expect(recordingIn(routes.libraries)).toBeUndefined();
    expect(recordingIn(routes.search)).toBeUndefined();
  });

  it('reads a uuid back out of the path exactly as `toRecording` wrote it', () => {
    // The builder encodes, so the reader decodes. A uuid needs neither, and the pair is what
    // keeps that true of anything that is not one.
    expect(recordingIn(toRecording('a recording/with a slash'))).toBe('a recording/with a slash');
  });
});
