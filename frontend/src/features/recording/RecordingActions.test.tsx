/**
 * V5's actions (`UI-13e`, §V5).
 *
 * The rule under test is §3.5's: **what somebody cannot do is absent, not disabled.** A row of
 * greyed-out buttons reads as a bug and their absence reads as a decision, so the tests are as
 * much about what is not on the screen as about what is -- and Download is on it whatever the
 * level, because principle 1 is that the original is yours.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import type { components } from '@/api/contract/schema';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { AVIA, CARRER_NOU, PERSONAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

/** Where the router ended up, so a test can assert what an action did with it. */
function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname}</div>;
}

function renderRecording(uuid: string = CARRER_NOU) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toRecording(uuid)]}>
          <Where />
          <Routes>
            <Route path={routes.recording} element={<RecordingView />} />
            <Route path={routes.library} element={<div>the library</div>} />
            <Route path={routes.librarySettings} element={<div>library settings</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

/** Level and library level, for the four combinations the actions depend on. */
function at(level: components['schemas']['Level'], libraryLevel = level) {
  archive.recordings = archive.recordings.map((one) =>
    one.uuid === CARRER_NOU ? { ...one, level } : one,
  );
  archive.libraries = archive.libraries.map((one) =>
    one.uuid === AVIA ? { ...one, level: libraryLevel } : one,
  );
}

describe('downloading the original', () => {
  it('is a link to the original, so the browser saves it', async () => {
    renderRecording();
    const download = await screen.findByRole('link', { name: 'Download the original' });
    // A link and not a button: it can be opened in a new tab and saved from the context menu,
    // and nothing has to fetch a 284 MB file into memory first.
    expect(download).toHaveAttribute('href', `/api/audio/${CARRER_NOU}/original`);
    expect(download).toHaveAttribute('download');
  });

  it('is there for somebody who can only read the recording', async () => {
    at(10);
    renderRecording();
    // Principle 1: the original is yours and is kept byte for byte. A screen that can play a
    // recording but not give it back would be a claim the software does not honour.
    expect(await screen.findByRole('link', { name: 'Download the original' })).toBeInTheDocument();
  });
});

describe('what a level does not allow', () => {
  it('offers nothing but the download at level 10', async () => {
    at(10);
    renderRecording();
    await screen.findByRole('link', { name: 'Download the original' });
    expect(screen.queryByRole('button', { name: 'Move to another library' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Trash' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    // Absent, and not one disabled control anywhere on the screen (§3.5).
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
  });

  it('offers moving and trashing at level 20, and sharing only at 30', async () => {
    at(20);
    renderRecording();
    expect(
      await screen.findByRole('button', { name: 'Move to another library' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trash' })).toBeInTheDocument();
    // Sharing is granted on the library and needs 30 there. Offering it at 20 would be offering
    // a way into a screen the API refuses.
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('offers sharing at level 30, and it leads to the library that grants it', async () => {
    const user = userEvent.setup();
    at(30);
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    expect(await screen.findByText('library settings')).toBeInTheDocument();
  });
});

describe('sending it to the trash', () => {
  it('says how long it can be restored for, from the instance own retention', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Trash' }));
    // 30 days in the fixtures, read from `/instance` rather than written into the interface.
    expect(await screen.findByText(/restored for 30 days/)).toBeInTheDocument();
  });

  it('asks first, and asks with a dialog rather than a typed confirmation', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Trash' }));
    const dialog = await screen.findByRole('dialog');
    // Typing a name is V9's hard delete, where something is actually destroyed. This one is
    // reversible for a month, and asking for a typed name would be asking for the wrong thing.
    expect(dialog.querySelector('input')).toBeNull();
    expect(archive.recordings.find((one) => one.uuid === CARRER_NOU)?.deleted_at).toBeNull();
  });

  it('trashes it and goes back to the library', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Trash' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(await within(dialog).findByRole('button', { name: 'Trash' }));
    await waitFor(() => {
      expect(screen.getByTestId('where').textContent).toBe(`/library/${AVIA}`);
    });
    expect(archive.recordings.find((one) => one.uuid === CARRER_NOU)?.deleted_at).not.toBeNull();
  });
});

describe('moving it', () => {
  it('opens the dialog that states the consequences, and moves on confirm', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Move to another library' }));
    await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
    await user.click(await screen.findByRole('option', { name: 'Personal' }));
    // The consequences, before anything happens: `Àvia Teresa` is shared with Marta and
    // `Personal` is not.
    expect(await screen.findByText(/Marta will no longer be able to see it/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move it' }));
    await waitFor(() => {
      expect(archive.recordings.find((one) => one.uuid === CARRER_NOU)?.library_uuid).toBe(
        PERSONAL,
      );
    });
  });

  it('does not offer the library it is already in as a destination', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Move to another library' }));
    await user.click(await screen.findByRole('combobox', { name: 'Move to' }));
    expect(screen.queryByRole('option', { name: 'Àvia Teresa' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Reunions Ateneu' })).toBeInTheDocument();
  });
});
