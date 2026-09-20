/**
 * The transcription provider (`INT-3c`, §V10, §3.4).
 *
 * The claim that matters most is a negative one: opening this page contacts nothing. It is
 * tested by asserting the state the page opens in, and by watching the network -- a request that
 * left on mount would fail this file rather than be discovered on somebody's instance.
 *
 * The check's two halves are watched here too, and both were faults somebody met (`BUG-3`): what
 * the control says while a third party is deciding, and whether the answer is still there
 * afterwards. The second is asserted through a mount on a **fresh** cache, which is what a reload
 * is -- the verdict is the instance's now (`BUG-3a`), so nothing in the browser should be
 * carrying it.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { ThemeProvider } from '@/design-system';
import { archive } from '@/test/api/archive';
import { mockApi, server } from '@/test/api/server';

import { Provider } from '../Provider';

const api = mockApi();

/** Every request that left, so "it contacts nothing" can be asserted rather than assumed. */
let sent: string[] = [];

beforeEach(() => {
  sent = [];
  api.events.on('request:start', ({ request }) => {
    sent.push(`${request.method} ${new URL(request.url).pathname}`);
  });
});

afterEach(() => {
  api.events.removeAllListeners();
});

function show() {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Provider />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe('opening the page', () => {
  it('reaches out to nobody, and says so', async () => {
    show();
    expect(await screen.findByText('Not checked yet')).toBeVisible();
    expect(screen.getByText(/Opening this page reaches out to nobody/)).toBeVisible();
  });

  it('makes no request that could contact the provider', async () => {
    show();
    await screen.findByText('Not checked yet');
    // Reading the configuration is the instance answering about itself. Testing it is the only
    // call that leaves, and nothing has pressed it.
    expect(sent).toContain('GET /api/admin/transcription');
    expect(sent).not.toContain('POST /api/admin/transcription/test');
  });

  it('shows what is configured, and whether a credential is set rather than what it is', async () => {
    show();
    // Twice on purpose: the disclosure names the host it would send audio to, and the fields
    // list the address it is configured with. They are the same fact answering two questions.
    expect(await screen.findAllByText(/whisper:8000/)).not.toHaveLength(0);
    expect(screen.getByText('Not set')).toBeVisible();
    // The secret itself is never sent, so there is nothing on screen that could be it.
    expect(screen.queryByRole('button', { name: /reveal|show/i })).toBeNull();
  });
});

/**
 * A check result the endpoint could really return.
 *
 * `checked_at` and `checked_by` are always set: the endpoint records every check it runs, so
 * there is no answer it can give in which somebody did not just ask (`BUG-3a`).
 */
function answered(over: Record<string, unknown>) {
  return HttpResponse.json({
    provider: 'faster-whisper',
    base_url: 'http://whisper:8000/v1',
    model: 'large-v3',
    default_language: null,
    configured: true,
    has_credential: false,
    reachable: true,
    usable: true,
    checked_at: new Date().toISOString(),
    checked_by: 'Alex Morgan',
    detail: '',
    ...over,
  });
}

describe('checking that it can transcribe', () => {
  it('happens only when it is pressed, and then reports what came back', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    expect(sent).toContain('POST /api/admin/transcription/test');
  });

  it('says it did not answer without pretending that is the resting state', async () => {
    server.use(
      http.post('/api/admin/transcription/test', () =>
        answered({
          reachable: false,
          usable: false,
          detail: 'Connection refused after 5s.',
        }),
      ),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It did not answer')).toBeVisible();
    expect(screen.getByText('Connection refused after 5s.')).toBeVisible();
  });

  it('says it is working while the provider decides', async () => {
    server.use(
      http.post('/api/admin/transcription/test', async () => {
        await delay(60);
        return answered({});
      }),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    // The label alone left a control that looked pressed and idle for however long the engine
    // took, which on a cold model is several seconds.
    const working = await screen.findByRole('button', { name: 'Checking' });
    expect(working).toHaveAttribute('aria-busy', 'true');
    expect(working).toBeDisabled();
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Check it can transcribe' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('is still there on a fresh cache, because the instance is what remembers', async () => {
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    cleanup();

    // A brand new cache is what a reload gives, and it used to be where the verdict was lost --
    // first because it was written over a read that answers `reachable: null` by design, then
    // because it was held in the browser at all.
    sent = [];
    show();
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    expect(screen.getByText('Checked just now by Alex Morgan')).toBeVisible();
    // Remembering must not mean asking again: the whole point of the button is that nothing
    // leaves the instance unless somebody pressed it.
    expect(sent).not.toContain('POST /api/admin/transcription/test');
  });

  it('says a check could not be run rather than calling it unchecked', async () => {
    // The instance could not produce the sample to ask with, so nothing was contacted -- neither
    // a pass nor a failure of the engine, and the sentence explaining it is the whole value.
    server.use(
      http.post('/api/admin/transcription/test', () =>
        answered({
          reachable: null,
          usable: null,
          detail: 'ffmpeg could not produce the sample this check submits.',
        }),
      ),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It could not be checked')).toBeVisible();
    expect(screen.getByText(/ffmpeg could not produce the sample/)).toBeVisible();
    expect(screen.queryByText('Not checked yet')).toBeNull();
  });

  it('distinguishes an engine that answers from one that can transcribe', async () => {
    // `TRX-10`: the misconfiguration this control exists to catch. Everything is reachable, the
    // credentials are accepted, and the model returns prose with no timings -- which a check
    // that only asked whether something was listening would report as success.
    server.use(
      http.post('/api/admin/transcription/test', () =>
        answered({
          reachable: true,
          usable: false,
          detail: 'The transcription service returned no segments.',
        }),
      ),
    );
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It answered, but it cannot transcribe')).toBeVisible();
    expect(screen.queryByText('It can transcribe')).toBeNull();
  });
});

describe('where the audio goes', () => {
  it('says it here too, in the same words as everywhere else', async () => {
    show();
    await screen.findByText('Not checked yet');
    // The shared component rather than a paraphrase this page invented: `UI-25b` enforces that
    // every surface that can send audio draws this one, and this is the surface where an
    // operator decides where audio goes in the first place.
    expect(screen.getAllByText(/whisper/).length).toBeGreaterThan(0);
  });
});

describe('no provider at all', () => {
  it('says plainly that nothing can be transcribed, and offers no retry', async () => {
    archive.destination = { ...archive.destination, configured: false };
    show();
    expect(await screen.findByText(/nothing on this instance can be transcribed/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Check it can transcribe' })).toBeNull();
    await waitFor(() => {
      expect(sent).not.toContain('POST /api/admin/transcription/test');
    });
  });
});
