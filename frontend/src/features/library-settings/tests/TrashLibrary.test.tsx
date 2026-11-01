/**
 * Sending a library to the trash (`UI-17f`, §V7).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { useToasts } from '@/app/toasts';
import { RECORDINGS, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { LibrarySettingsView } from '../LibrarySettingsView';

mockApi();

afterEach(() => {
  useToasts.setState({ toasts: [] });
});

/** What the toast store holds now: what was said, and the label of what it offers. */
function said() {
  return useToasts
    .getState()
    .toasts.map((one) => ({ tone: one.tone, message: one.message, action: one.action?.label }));
}

/** Press a toast's button, as the region would: it goes, and its action runs. */
function press(message: string) {
  const toast = useToasts.getState().toasts.find((one) => one.message === message);
  if (toast?.action === undefined) throw new Error(`nothing to press on ${message}`);
  useToasts.getState().dismiss(toast.id);
  act(() => {
    toast.action?.run();
  });
}

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function show(uuid: string = RECORDINGS) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[toLibrarySettings(uuid)]}>
        <Where />
        <Routes>
          <Route path={routes.librarySettings} element={<LibrarySettingsView />} />
          <Route path={routes.libraries} element={<p>the landing page</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('trashing a library', () => {
  it('counts what goes with it and says how long it can come back', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /move this library/i }));
    expect(await screen.findByText(/Its 3 recordings go with it/)).toBeVisible();
    // The window is the instance's setting, not a number written into the bundle -- and it is
    // absent until the instance has answered rather than guessed at.
    expect(await screen.findByText(/put it back for 30 days/i)).toBeInTheDocument();
  });

  it('is a confirm and not a typed one, because it can be undone', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /move this library/i }));
    // Typing the name out is the gesture for permanent deletion, and this is not that.
    expect(screen.queryByRole('textbox', { name: /type/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move it to the trash' })).toBeEnabled();
  });

  it('leaves for the landing page, since the screen it was on no longer resolves', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /move this library/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Move it to the trash' }));
    await waitFor(() => {
      expect(screen.getByTestId('where')).toHaveTextContent(routes.libraries);
    });
    expect(archive.libraries.find((one) => one.uuid === RECORDINGS)?.deleted_at).not.toBeNull();
  });

  it('says it went, and undoing it brings it back (UI-47)', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /move this library/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Move it to the trash' }));
    await waitFor(() => {
      expect(said()).toEqual([
        { tone: 'done', message: 'Field recordings sent to the trash', action: 'Undo' },
      ]);
    });
    press('Field recordings sent to the trash');
    await waitFor(() => {
      expect(said()).toEqual([
        { tone: 'done', message: 'Field recordings restored', action: undefined },
      ]);
    });
    expect(archive.libraries.find((one) => one.uuid === RECORDINGS)?.deleted_at).toBeNull();
  });

  it('is offered for the personal library, which is only the first of them', async () => {
    show(PERSONAL);
    await screen.findByRole('heading', { name: 'Personal' });
    expect(await screen.findByRole('button', { name: /move this library/i })).toBeVisible();
  });

  it('is not offered at all on the only library the account owns', async () => {
    // `DAT-9`: the API refuses the last one, and a button that always fails is worse than none.
    archive.libraries = archive.libraries.filter((one) => one.uuid !== RECORDINGS);
    show(PERSONAL);
    await screen.findByRole('heading', { name: 'Personal' });
    expect(screen.queryByRole('button', { name: /move this library/i })).not.toBeInTheDocument();
  });
});
