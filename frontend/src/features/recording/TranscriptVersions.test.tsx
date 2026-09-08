/**
 * Which transcript is shown, and asking for another (`UI-14a`, `UI-25a`, §V5).
 *
 * Two versions is a shape the fixture archive does not hold -- it keeps one active transcript per
 * recording, which is what `GET /transcript` serves -- so the tests that need a second one shape
 * that one endpoint with `server.use`. Re-transcription is what makes a second version exist in
 * the first place, and without this control it is unreachable from the interface, which is the
 * reason `UI-14a` exists at all.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { CARRER_NOU, archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

/** A recording with two transcripts, newest first, as the endpoint sends them. */
function twoVersions(activeId = 2) {
  const first = archive.transcripts[CARRER_NOU];
  if (first === undefined) throw new Error('The fixture has no transcript.');
  const { segments: _segments, ...summary } = first;
  server.use(
    http.get('/api/audio/:audio_uuid/transcripts', () =>
      HttpResponse.json([
        {
          ...summary,
          id: 2,
          model: 'large-v3-turbo',
          language: 'ca',
          created_at: '2026-04-02T11:00:00Z',
          is_active: activeId === 2,
        },
        { ...summary, id: 1, model: 'small', language: 'es', is_active: activeId === 1 },
      ]),
    ),
  );
}

/** One row of the selector, or a failure that says which one was missing. */
function rowAt(list: HTMLElement, index: number): HTMLElement {
  const row = within(list).getAllByRole('listitem')[index];
  if (row === undefined) throw new Error(`The selector has no row ${String(index)}.`);
  return row;
}

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

describe('the selector', () => {
  it('is not there when there is only one transcript', async () => {
    renderRecording();
    await screen.findByText('6 segments');
    // One transcript is not a version: a selector offering one option teaches somebody there is
    // something to decide when there is not.
    expect(screen.queryByRole('list', { name: 'Transcript' })).toBeNull();
  });

  it('names each version by what distinguishes it, and which one is shown', async () => {
    twoVersions();
    renderRecording();
    const list = await screen.findByRole('list', { name: 'Transcript' });
    // Numbered from the oldest, so `v1` stays the first one that was ever made -- and named by
    // model, language and date, because "v2" says nothing about why you would want the other.
    expect(rowAt(list, 0).textContent).toMatch(/v2 · large-v3-turbo · ca/);
    expect(rowAt(list, 1).textContent).toMatch(/v1 · small · es/);
    expect(within(rowAt(list, 0)).getByText('Shown')).toBeInTheDocument();
  });

  it('switches to another version, and the essentials line follows', async () => {
    const user = userEvent.setup();
    twoVersions();
    renderRecording();
    const list = await screen.findByRole('list', { name: 'Transcript' });
    await user.click(within(rowAt(list, 1)).getByRole('button', { name: 'Show this one' }));
    // Atomic on the server (`JOB-7`), so the interface asks and re-reads rather than defending
    // against a half-switched state.
    await waitFor(() => {
      expect(screen.getByText(/Transcript v/)).toBeInTheDocument();
    });
  });

  it('offers no switch to somebody who can only read the recording', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    twoVersions();
    renderRecording();
    const list = await screen.findByRole('list', { name: 'Transcript' });
    // Absent rather than disabled: switching is a change to the recording (§3.5).
    expect(within(list).queryByRole('button', { name: 'Show this one' })).toBeNull();
    expect(within(list).getByText('Shown')).toBeInTheDocument();
  });
});

describe('asking for another transcription', () => {
  it('says where the audio goes on the same row as the control', async () => {
    renderRecording();
    const again = await screen.findByRole('button', { name: 'Transcribe again' });
    const notice = again.closest('[data-ds="egress-notice"]');
    // Same endpoint as the call to action and the retry, so the same disclosure. There are no
    // request paths without one (§3.4).
    expect(notice).not.toBeNull();
    expect(within(notice as HTMLElement).getByText(/whisper/)).toBeInTheDocument();
  });

  it('asks, and the recording reads as running again', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Transcribe again' }));
    await waitFor(() => {
      expect(screen.getByText('Transcribing')).toBeInTheDocument();
    });
  });

  it('is absent when the instance has no provider to send it to', async () => {
    archive.destination = { provider: '', host: null, is_local: false, configured: false };
    renderRecording();
    await screen.findByText('6 segments');
    expect(screen.queryByRole('button', { name: 'Transcribe again' })).toBeNull();
  });

  it('is absent for somebody who can only read the recording', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CARRER_NOU ? { ...one, level: 10 } : one,
    );
    renderRecording();
    await screen.findByText('6 segments');
    expect(screen.queryByRole('button', { name: 'Transcribe again' })).toBeNull();
  });
});
