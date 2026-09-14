/**
 * V5's player panel (`UI-11b`, `UI-11f`, §V5).
 *
 * What is worth asserting is that it is **not a second player**: every control writes to the one
 * store the bar in the shell reads, so the tests look at the store rather than at the panel. The
 * drawing is `Waveform`'s and is already held by the design system; what belongs here is that a
 * recording with no peaks makes no request for them and says so in words.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { usePlayback } from '@/player/store';
import { FIELD_TAKE, VOICE_NOTE } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { RecordingView } from '../RecordingView';

mockApi();

afterEach(() => {
  usePlayback.getState().stop();
});

function renderRecording(uuid: string = FIELD_TAKE) {
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

describe('the transport', () => {
  it('starts the recording in the one playback state the shell also reads', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    // The store, not a local flag: the bar at the bottom of the shell is the same sound, and a
    // panel with its own idea of what is playing would be the second player (§3.1).
    expect(usePlayback.getState().recording?.uuid).toBe(FIELD_TAKE);
    expect(usePlayback.getState().recording?.library).toBe('Field recordings');
  });

  it('does not claim to be playing while it is still buffering', async () => {
    const user = userEvent.setup();
    renderRecording();
    const play = await screen.findByRole('button', { name: 'Play' });
    await user.click(play);
    // §3.1: buffering holds the position and does not turn into a pause control. A transport
    // that said "pause" for a three-hour file that has not started would be a lie the length of
    // the buffer.
    expect(usePlayback.getState().status).toBe('buffering');
    expect(screen.getByRole('button', { name: 'Play' })).toHaveAttribute('aria-busy', 'true');
  });

  it('pauses what it started, from the same control', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    // What the audio element reports when it actually starts. Nothing connects one in jsdom,
    // which is the whole reason the store holds what is true rather than what was asked for.
    usePlayback.getState().report({ status: 'playing' });
    await user.click(await screen.findByRole('button', { name: 'Pause' }));
    expect(usePlayback.getState().status).toBe('paused');
  });

  it('skips fifteen seconds, which is what the keyboard does as well', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    usePlayback.getState().report({ status: 'playing', positionMs: 60_000 });
    await user.click(screen.getByRole('button', { name: /Forward 15 seconds/ }));
    expect(usePlayback.getState().positionMs).toBe(75_000);
    await user.click(screen.getByRole('button', { name: /Back 15 seconds/ }));
    expect(usePlayback.getState().positionMs).toBe(60_000);
  });
});

describe('the waveform', () => {
  it('seeks, and to the recording own length rather than to whatever loaded', async () => {
    const user = userEvent.setup();
    renderRecording();
    const seek = await screen.findByRole('slider', { name: /Seek in Field recording, long take/ });
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    seek.focus();
    // `End` is the design system's own binding for the far end. 48:12 in the fixtures, from the
    // API, so a seek is possible before any audio has loaded.
    await user.keyboard('{End}');
    expect(usePlayback.getState().positionMs).toBe(2_892_000);
  });

  it('asks for the peaks a 130px drawing can use and not the stored 28,800', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderRecording();
    await screen.findByRole('slider', { name: /Seek in/ });
    // `ING-14`'s reason for existing: the server reduces on the way out, so the detail view
    // costs a couple of thousand pairs rather than a megabyte for one picture.
    await waitFor(() => {
      expect(asked.some((url) => url.includes(`/audio/${FIELD_TAKE}/waveform?peaks=1200`))).toBe(
        true,
      );
    });
  });
});

describe('a recording whose peaks job has not run', () => {
  it('says so in this view own words rather than showing an empty box', async () => {
    renderRecording(VOICE_NOTE);
    expect(await screen.findByText(/The waveform is still being made/)).toBeInTheDocument();
  });

  it('asks for no peaks, because the request would answer 404', async () => {
    const asked: string[] = [];
    server.events.on('request:start', ({ request }) => asked.push(request.url));
    renderRecording(VOICE_NOTE);
    await screen.findByText(/The waveform is still being made/);
    // `has_waveform` is the flag and is on the recording, so the interface never guesses from an
    // empty blob (§3.5).
    expect(asked.some((url) => url.includes(`/audio/${VOICE_NOTE}/waveform`))).toBe(false);
  });

  it('still says how long it is, and plays', async () => {
    const user = userEvent.setup();
    renderRecording(VOICE_NOTE);
    await user.click(await screen.findByRole('button', { name: 'Play' }));
    expect(usePlayback.getState().recording?.uuid).toBe(VOICE_NOTE);
    expect(screen.getAllByText(/01:48/).length).toBeGreaterThan(0);
  });
});

describe('the speed control', () => {
  it('offers the six rates and sets the one that is chosen', async () => {
    const user = userEvent.setup();
    renderRecording();
    await user.click(await screen.findByRole('button', { name: /Playback speed, now 1.0x/ }));
    await user.click(await screen.findByRole('menuitem', { name: '1.5x' }));
    // The store's rate, so the bar's pill reads 1.5x too rather than the two disagreeing.
    expect(usePlayback.getState().rate).toBe(1.5);
    expect(await screen.findByRole('button', { name: /now 1.5x/ })).toBeInTheDocument();
  });
});
