/**
 * 🧪 The interface listening instead of asking (`REV-12`).
 *
 * Two things are worth a test here. That an event the instance sends reaches the cache as the
 * change it means -- which is the whole point of the stream -- and that losing the stream puts the
 * polling back, because a client that has quietly stopped both asking and listening is worse than
 * one that only ever asked.
 */

import { QueryClientProvider, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/api/query-client';
import { keys } from '@/api/keys';
import { LiveArchive } from '@/app/events';
import { useLiveArchive } from '@/app/live-archive';
import { FakeEventSource, withEventSource, withoutEventSource } from '@/test/support/event-source';

function testClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0, gcTime: 0 } });
  return client;
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <LiveArchive>{children}</LiveArchive>
      </QueryClientProvider>
    );
  };
}

/** What the subscriber is: a reader of `useLiveArchive`, which is what the polls read. */
function Listening() {
  return <span>{useLiveArchive() ? 'live' : 'asking'}</span>;
}

beforeEach(withEventSource);
afterEach(withoutEventSource);

describe('the stream', () => {
  it('is opened once, at the path the deployment serves', () => {
    render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    expect(FakeEventSource.opened).toHaveLength(1);
    expect(FakeEventSource.latest().url).toBe('/api/events');
  });

  it('is closed when the frame around it goes, rather than left open', () => {
    const view = render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    const source = FakeEventSource.latest();
    view.unmount();
    expect(source.closed).toBe(true);
  });
});

describe('what an event makes stale', () => {
  it('turns a recording into the change that names everything showing it', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });

    FakeEventSource.latest().send('audio', 'a-uuid');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.recording('a-uuid')] });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.libraries()] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.search()] });
  });

  it('turns a library into its own change', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });

    FakeEventSource.latest().send('library', 'l-uuid');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.library('l-uuid')] });
    });
  });

  it('refetches everything when the instance says it lost our place', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });

    FakeEventSource.latest().send('resync');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith();
    });
  });

  it('ignores a frame it cannot read rather than tearing the stream down', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });
    const source = FakeEventSource.latest();

    source.send('audio');
    source.send('audio', 'a-uuid');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.recording('a-uuid')] });
    });
    expect(source.closed).toBe(false);
  });
});

describe('what the polls are told', () => {
  it('says nothing is listening until the instance accepts the subscription', () => {
    render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    // Opened is not connected: a proxy that will never flush this has already accepted the
    // socket, and polling has to keep going until something actually arrives.
    expect(screen.getByText('asking')).toBeInTheDocument();
  });

  it('stops the asking once the stream is connected', async () => {
    render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    FakeEventSource.latest().open();
    expect(await screen.findByText('live')).toBeInTheDocument();
  });

  it('starts asking again when the stream drops', async () => {
    render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    const source = FakeEventSource.latest();
    source.open();
    expect(await screen.findByText('live')).toBeInTheDocument();

    source.fail();

    expect(await screen.findByText('asking')).toBeInTheDocument();
  });

  it('polls where there is no EventSource at all', () => {
    withoutEventSource();
    render(
      <QueryClientProvider client={testClient()}>
        <LiveArchive>
          <Listening />
        </LiveArchive>
      </QueryClientProvider>,
    );
    expect(screen.getByText('asking')).toBeInTheDocument();
  });
});

describe('a burst', () => {
  it('asks once for a recording three jobs finished on', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });
    const source = FakeEventSource.latest();

    // An upload finishes probe, waveform and transcode within about a tenth of a second.
    source.send('audio', 'a-uuid');
    source.send('audio', 'a-uuid');
    source.send('audio', 'a-uuid');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.recording('a-uuid')] });
    });
    const forThatRecording = invalidate.mock.calls.filter(
      ([options]) =>
        JSON.stringify(options) === JSON.stringify({ queryKey: [...keys.recording('a-uuid')] }),
    );
    expect(forThatRecording).toHaveLength(1);
  });

  it('still asks for each of two recordings', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });
    const source = FakeEventSource.latest();

    source.send('audio', 'one');
    source.send('audio', 'two');

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.recording('two')] });
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...keys.recording('one')] });
  });
});

describe('reconnecting', () => {
  it('does not refetch the page it has only just loaded', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });

    FakeEventSource.latest().open();

    await waitFor(() => {
      expect(FakeEventSource.latest().closed).toBe(false);
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('refetches what changed while it was not listening', async () => {
    const client = testClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    renderHook(() => useQueryClient(), { wrapper: wrapper(client) });
    const source = FakeEventSource.latest();

    source.open();
    source.fail();
    source.open();

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith();
    });
  });
});
