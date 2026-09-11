/**
 * V7's identity block (`UI-17a`, §V7).
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toLibrarySettings } from '@/app/routes';
import { ATENEU, AVIA, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { LibrarySettingsView } from './LibrarySettingsView';

mockApi();

function show(uuid: string = AVIA) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[toLibrarySettings(uuid)]}>
        <Routes>
          <Route path={routes.librarySettings} element={<LibrarySettingsView />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('getting back to the library', () => {
  it('names the library and links to it', async () => {
    show();
    const where = await screen.findByRole('navigation', {
      name: 'The library these settings belong to',
    });
    expect(within(where).getByRole('link', { name: 'Àvia Teresa' })).toHaveAttribute(
      'href',
      `/library/${AVIA}`,
    );
  });
});

describe('what the library is called', () => {
  it('renames it on blur, with no Save button to forget', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Àvia Teresa/ }));
    const field = screen.getByRole('textbox', { name: 'Name' });
    await userEvent.clear(field);
    await userEvent.type(field, 'Àvia Teresa i família');
    await userEvent.tab();
    await waitFor(() => {
      expect(archive.libraries.find((one) => one.uuid === AVIA)?.name).toBe(
        'Àvia Teresa i família',
      );
    });
  });

  it('says the colour reaches the sidebar straight away, because it does', async () => {
    show();
    expect(await screen.findByText(/appears in the sidebar straight away/i)).toBeVisible();
  });

  it('leaves the fields as facts, not as disabled boxes, when you cannot manage it', async () => {
    server.use(
      http.get('/api/libraries/:library_uuid', ({ params }) =>
        HttpResponse.json({
          ...archive.libraries.find((one) => one.uuid === params.library_uuid),
          level: 20,
        }),
      ),
    );
    show(ATENEU);
    // The name is text on the page under an overline, not a control: `InlineField` draws
    // read-only as a fact rather than as a disabled box.
    await screen.findByRole('heading', { name: 'Reunions Ateneu' });
    expect(screen.queryByRole('button', { name: /Reunions Ateneu/ })).not.toBeInTheDocument();
    // No colour picker at all: an unavailable action is absent, not disabled.
    expect(screen.queryByText(/appears in the sidebar/i)).not.toBeInTheDocument();
  });

  it('says a library that is not there and one that is not yours the same way', async () => {
    server.use(
      http.get('/api/libraries/:library_uuid', () =>
        HttpResponse.json(
          {
            type: '/errors/not_found',
            title: 'Not found',
            detail: 'There is no such thing here, or it is not yours.',
            status: 404,
            request_id: 'test',
          },
          { status: 404, headers: { 'content-type': 'application/problem+json' } },
        ),
      ),
    );
    show();
    expect(
      await screen.findByText(/may have been deleted, or it may never have been yours/i),
    ).toBeVisible();
  });
});
