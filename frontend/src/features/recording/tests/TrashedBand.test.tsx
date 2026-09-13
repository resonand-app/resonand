/**
 * A recording in the trash (`UI-11d`, §V5).
 *
 * The state's three claims are what is tested: it can be **played**, it can be **put back**, and
 * nothing about it can be **changed**. The last is the one worth a test, because it is not a
 * permission -- somebody at level 40 looking at their own trashed recording still cannot edit it,
 * and every field has to draw itself as a fact rather than as a disabled control.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { usePlayback } from '@/player/store';
import { CARRER_NOU, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingView } from '../RecordingView';

mockApi();

/** In the trash, eight days ago, with the fixture instance's thirty-day retention. */
beforeEach(() => {
  const deleted = new Date(Date.now() - 8 * 86_400_000).toISOString();
  archive.recordings = archive.recordings.map((one) =>
    one.uuid === CARRER_NOU ? { ...one, deleted_at: deleted } : one,
  );
});

function renderRecording(uuid: string = CARRER_NOU) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[toRecording(uuid)]}>
          <Routes>
            <Route path={routes.recording} element={<RecordingView />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('the band', () => {
  it('says what it is and how long is left, counted from the instance own retention', async () => {
    renderRecording();
    expect(await screen.findByText(/This recording is in the trash/)).toBeInTheDocument();
    // Thirty days' retention, eight days gone: twenty-two left. Not a number written down here,
    // and not shown at all until the instance has answered -- "0 days left" from a missing
    // retention is the one thing this must never say.
    expect(await screen.findByText(/22 days left/)).toBeInTheDocument();
  });

  it('is part of the page rather than a toast that goes away', async () => {
    renderRecording();
    const band = await screen.findByText(/This recording is in the trash/);
    // A message about a deletion that vanishes after four seconds is one that has to be read at
    // exactly the wrong moment. This is in the flow of the page, above the title.
    expect(band.closest('[data-ds="toast"]')).toBeNull();
    expect(band.closest('[data-ds="toast-region"]')).toBeNull();
    expect(band.closest('[data-app="trashed-band"]')).toHaveAttribute('role', 'status');
  });

  it('replaces the read-only line rather than sitting above it', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    await screen.findByText(/This recording is in the trash/);
    // Both would be true, and only one of them is the reason nothing here can be changed.
    expect(screen.queryByText(/You can read this recording/)).toBeNull();
  });
});

describe('what it still does', () => {
  it('plays', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    expect(usePlayback.getState().recording?.uuid).toBe(CARRER_NOU);
    usePlayback.getState().stop();
  });

  it('goes back into the library it came from', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Put it back' }));
    await waitFor(() => {
      expect(archive.recordings.find((one) => one.uuid === CARRER_NOU)?.deleted_at).toBeNull();
    });
    expect(screen.queryByText(/This recording is in the trash/)).toBeNull();
  });

  it('offers no way back to somebody who could only read it', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    await screen.findByText(/This recording is in the trash/);
    expect(screen.queryByRole('button', { name: 'Put it back' })).toBeNull();
  });
});

describe('what it does not do', () => {
  it('lets nothing be edited, even by whoever owns it', async () => {
    renderRecording();
    await screen.findByText(/This recording is in the trash/);
    // Not a permission: the level is 40 here. Being in the trash is a state, and the fields draw
    // themselves as facts rather than as disabled controls (§3.5).
    expect(screen.queryByRole('button', { name: /The house on Carrer Nou/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add a tag' })).toBeNull();
    expect(document.querySelectorAll('[disabled]')).toHaveLength(0);
  });

  it('offers none of the actions that change it', async () => {
    renderRecording();
    await screen.findByText(/This recording is in the trash/);
    expect(screen.queryByRole('button', { name: 'Move to another library' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to the trash' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Transcribe again' })).toBeNull();
    // The original is still yours, in the trash or out of it.
    expect(screen.getByRole('link', { name: 'Download the original' })).toBeInTheDocument();
  });
});
