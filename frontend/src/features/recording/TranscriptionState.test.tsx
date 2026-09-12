/**
 * The three states a recording without a transcript can be in (`UI-15a`, `UI-15b`, `UI-15c`,
 * `UI-25a`, §V5).
 *
 * The assertions are about honesty rather than about layout. `running` says when it started and
 * **never shows a percentage**, because nothing stores one. `failed` shows the provider's own
 * words, which exist only on the job and are the reason `API-17` was built. And **no path to a
 * transcription is offered without the disclosure above or beside it**, which is principle 2's
 * only implementation.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { routes, toRecording } from '@/app/routes';
import { ThemeProvider } from '@/design-system';
import { ASSAIG, CANCONS, CARRER_NOU, NOTA, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { RecordingView } from './RecordingView';

mockApi();

function renderRecording(uuid: string) {
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

describe('a recording nobody has asked about', () => {
  it('asks, and says where the audio would go before it goes', async () => {
    renderRecording(NOTA);
    expect(await screen.findByText(/has not been transcribed/)).toBeInTheDocument();
    // The local register: `whisper` is on the instance's own network in the fixtures, so the
    // notice is calm and factual rather than a warning (§3.4).
    expect(await screen.findByText(/on your own network/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Transcribe this recording' })).toBeInTheDocument();
  });

  it('says the audio leaves the instance when the provider is not local', async () => {
    archive.destination = {
      provider: 'openai',
      host: 'api.openai.com',
      is_local: false,
      configured: true,
    };
    renderRecording(NOTA);
    // The other register, and the sentence somebody reads before their recording leaves the
    // machine: factual, and about this instance rather than about them.
    expect(await screen.findByText(/The audio leaves this instance/)).toBeInTheDocument();
  });

  it('offers nothing to press when the instance has no provider', async () => {
    archive.destination = { provider: '', host: null, is_local: false, configured: false };
    renderRecording(NOTA);
    // Not an error. Offering to transcribe would be offering something that cannot happen.
    expect(await screen.findByText(/No transcription provider is configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Transcribe this recording' })).toBeNull();
  });

  it('offers nothing to press to somebody who can only read it', async () => {
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === NOTA ? { ...one, level: 10 } : one,
    );
    renderRecording(NOTA);
    await screen.findByText(/has not been transcribed/);
    expect(screen.queryByRole('button', { name: 'Transcribe this recording' })).toBeNull();
    // Said once, so the absence reads as a decision rather than as a missing button (§3.5).
    expect(await screen.findByText(/Only somebody who can edit/)).toBeInTheDocument();
  });

  it('asks for one, and the recording then reads as running', async () => {
    const user = userEvent.setup();
    renderRecording(NOTA);
    await user.click(await screen.findByRole('button', { name: 'Transcribe this recording' }));
    expect(await screen.findByText('Transcribing')).toBeInTheDocument();
  });
});

describe('a transcription that is running', () => {
  it('says when it started and shows no progress anywhere', async () => {
    renderRecording(CANCONS);
    expect(await screen.findByText('Transcribing')).toBeInTheDocument();
    // Nothing stores a percentage, so a bar would be an animation with no number behind it (§6).
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+%/);
    expect(await screen.findByText(/Started .* on faster-whisper/)).toBeInTheDocument();
  });

  it('names the attempt once it is past the first', async () => {
    archive.jobs = archive.jobs.map((one) =>
      one.audio_uuid === CANCONS ? { ...one, attempts: 3 } : one,
    );
    renderRecording(CANCONS);
    // "attempt 1 of 5" on every screen would be noise; "attempt 3" is the fact that explains
    // why this is taking so long.
    expect(await screen.findByText(/attempt 3/)).toBeInTheDocument();
  });

  it('says it is waiting when the job has not begun rather than counting from nothing', async () => {
    archive.jobs = archive.jobs.map((one) =>
      one.audio_uuid === CANCONS ? { ...one, state: 'pending', started_at: null } : one,
    );
    renderRecording(CANCONS);
    expect(await screen.findByText(/Waiting to start/)).toBeInTheDocument();
  });

  it('turns its glyph, because a still card is the picture a stalled job draws', async () => {
    // `FBK-6`. The animation itself belongs to the stylesheet; what the component owes is the
    // attribute that says this job is alive.
    const { container } = renderRecording(CANCONS);
    await screen.findByText('Transcribing');
    expect(container.querySelector('[data-ds="state-card-glyph"]')).toHaveAttribute(
      'data-busy',
      'true',
    );
  });

  it('advances the elapsed time on its own, without the instance saying anything new', async () => {
    // The bug `FBK-6` fixes: the poll answers the same four fields every ten seconds, structural
    // sharing keeps the object identical, tracked properties mean no re-render, and "Started less
    // than a minute ago" stayed on screen for the whole transcription.
    // The clock has to be fake before the card mounts, because the interval it sets is the thing
    // under test. `shouldAdvanceTime` keeps the request layer moving while it is.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const startedAt = new Date(Date.now() - 5_000).toISOString();
      archive.jobs = archive.jobs.map((one) =>
        one.audio_uuid === CANCONS ? { ...one, started_at: startedAt } : one,
      );
      renderRecording(CANCONS);
      expect(await screen.findByText(/Started less than a minute ago/)).toBeInTheDocument();

      // Nothing about the instance's answer changes here. Only the clock moves.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60_000);
      });
      expect(await screen.findByText(/Started 2 minutes ago/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a transcription that failed', () => {
  it('shows the provider own words rather than apologising', async () => {
    renderRecording(ASSAIG);
    expect(await screen.findByText(/did not finish/)).toBeInTheDocument();
    // The text is on the job and nowhere else, which is why `API-17` had to exist first.
    expect(
      await screen.findByText('The transcription provider did not answer.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/sorry/i);
  });

  it('offers a retry with the disclosure on the same row', async () => {
    renderRecording(ASSAIG);
    const retry = await screen.findByRole('button', { name: 'Try transcribing again' });
    const notice = retry.closest('[data-ds="egress-notice"]');
    // Beside the retry and in the retry's own register: retrying sends the audio again, which is
    // a fact about the button next to it (§3.4).
    expect(notice).not.toBeNull();
    expect(within(notice as HTMLElement).getByText(/whisper/)).toBeInTheDocument();
  });

  it('retries, and the recording reads as running again', async () => {
    const user = userEvent.setup();
    renderRecording(ASSAIG);
    await user.click(await screen.findByRole('button', { name: 'Try transcribing again' }));
    await waitFor(() => {
      expect(screen.getByText('Transcribing')).toBeInTheDocument();
    });
  });

  it('offers no retry when nothing can be transcribed at all', async () => {
    archive.destination = { provider: '', host: null, is_local: false, configured: false };
    renderRecording(ASSAIG);
    await screen.findByText(/did not finish/);
    expect(await screen.findByText(/No transcription provider is configured/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try transcribing again' })).toBeNull();
  });
});

describe('a recording that has a transcript', () => {
  it('shows the transcript rather than any of the three states', async () => {
    renderRecording(CARRER_NOU);
    await screen.findByText('6 segments');
    expect(screen.queryByText(/has not been transcribed/)).toBeNull();
    expect(screen.queryByText('Transcribing')).toBeNull();
    expect(screen.queryByText(/did not finish/)).toBeNull();
  });
});
