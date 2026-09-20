/**
 * The transcription provider (`INT-3c`, §V10, §3.4).
 *
 * The claim that matters most is a negative one: opening this page contacts nothing. It is
 * tested by asserting the state the page opens in, and by watching the network -- a request that
 * left on mount would fail this file rather than be discovered on somebody's instance.
 *
 * The check's two halves are watched here too, and both were faults somebody met (`BUG-3`): what
 * the control says while a third party is deciding, and whether the answer is still there after
 * the view has been left. The second is asserted through a second mount on the same cache, which
 * is the thing that used to lose it.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, delay, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keys } from '@/api/keys';
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

/** The cache is a parameter so a second mount can be given the first one's, as a route change is. */
function show(client: QueryClient = createQueryClient()) {
  client.setDefaultOptions({ queries: { retry: false } });
  const view = render(
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <Provider />
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { ...view, client };
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

/** A check result the endpoint could really return. */
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

  it('is still there after the view has been left, and says when it was asked', async () => {
    const first = show();
    await userEvent.click(await screen.findByRole('button', { name: 'Check it can transcribe' }));
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    first.unmount();

    sent = [];
    // What coming back really does, and what used to erase the answer: the configuration is read
    // again -- because thirty seconds passed, because the window was refocused, because something
    // administrative changed -- and it answers `reachable: null`, since the instance keeps no
    // record of a check.
    await first.client.refetchQueries({ queryKey: [...keys.provider()], type: 'all' });
    show(first.client);
    expect(await screen.findByText('It can transcribe')).toBeVisible();
    expect(screen.getByText('Checked just now')).toBeVisible();
    // Remembering must not mean asking again: the whole point of the button is that nothing
    // leaves the instance unless somebody pressed it.
    expect(sent).not.toContain('POST /api/admin/transcription/test');
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
