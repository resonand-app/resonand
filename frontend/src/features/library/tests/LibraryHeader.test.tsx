/**
 * The head of a library (`UI-6a`, §V3, §3.5).
 *
 * The two things worth holding are both about what is absent. Settings is not there below manage,
 * rather than there and disabled; and the owner's name is not there when the owner is you, which
 * is the difference between a header and a form somebody filled in.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { ATENEU, AVIA, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';
import { toLibrary } from '@/app/routes';

import { LibraryView } from '../LibraryView';

mockApi();

function renderLibrary(uuid: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toLibrary(uuid)]}>
          <Routes>
            <Route path="/library/:uuid" element={<LibraryView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the header', () => {
  it('carries the name, the count and the total', async () => {
    renderLibrary(AVIA);
    expect(await screen.findByRole('heading', { name: 'Àvia Teresa', level: 1 })).toBeVisible();
    expect(screen.getByText(/3 recordings · 2.h.04.min/u)).toBeVisible();
  });

  it('names the owner only when the owner is somebody else', async () => {
    renderLibrary(ATENEU);
    expect(await screen.findByText(/^Marta · /)).toBeVisible();
    renderLibrary(AVIA);
    expect(await screen.findByRole('heading', { name: 'Àvia Teresa' })).toBeVisible();
    expect(screen.queryByText(/^Gabriel · /)).toBeNull();
  });

  it('offers Settings to somebody who can manage the library', async () => {
    renderLibrary(AVIA);
    expect(await screen.findByRole('button', { name: /Settings/ })).toBeVisible();
  });

  it('leaves Settings out below manage rather than showing it disabled', async () => {
    // Level 20 on the Ateneu library in the fixtures: enough to edit a recording, not enough to
    // reach the settings view. A disabled button reads as a bug; its absence reads as a decision.
    renderLibrary(ATENEU);
    await screen.findByRole('heading', { name: 'Reunions Ateneu' });
    expect(screen.queryByRole('button', { name: /Settings/ })).toBeNull();
  });

  it('says once, quietly, that a library can only be read', async () => {
    archive.libraries = archive.libraries.map((one) =>
      one.uuid === ATENEU ? { ...one, level: 10 } : one,
    );
    renderLibrary(ATENEU);
    expect(await screen.findByText('You can read this library.')).toBeVisible();
  });

  it('says nothing about read-only when there is nothing to say', async () => {
    renderLibrary(AVIA);
    await screen.findByRole('heading', { name: 'Àvia Teresa' });
    expect(screen.queryByText('You can read this library.')).toBeNull();
  });
});

describe('a library that is not there', () => {
  it('never says you do not have permission', async () => {
    renderLibrary('00000000-0000-4000-8000-000000000000');
    // 404 covers both "deleted" and "not yours", on purpose: a 403 would confirm the library
    // exists. The wording has to hold that line.
    expect(await screen.findByText(/There is no library at this address/)).toBeVisible();
    expect(
      screen.getByText(/may have been deleted, or it may never have been yours/),
    ).toBeVisible();
    expect(document.body.textContent).not.toMatch(/permission/i);
  });
});
