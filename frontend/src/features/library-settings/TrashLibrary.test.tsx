/**
 * Sending a library to the trash (`UI-17f`, §V7).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { AVIA, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { LibrarySettingsView } from './LibrarySettingsView';

mockApi();

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function show(uuid: string = AVIA) {
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
    expect(archive.libraries.find((one) => one.uuid === AVIA)?.deleted_at).not.toBeNull();
  });

  it('is not offered at all for the personal library', async () => {
    show(PERSONAL);
    await screen.findByRole('heading', { name: 'Personal' });
    expect(screen.queryByRole('button', { name: /move this library/i })).not.toBeInTheDocument();
  });
});
