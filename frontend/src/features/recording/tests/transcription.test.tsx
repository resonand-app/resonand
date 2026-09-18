/**
 * The poll that used to talk to nobody (`FBK-2`).
 *
 * `GET /audio/{uuid}/transcription` was already asked every ten seconds while a job ran, and the
 * card above it was drawn from `transcription_state` on the recording -- a different query, which
 * nothing refetched. So a transcription finished, the poll saw it finish, and the screen said
 * "Transcribing" until somebody reloaded the page.
 *
 * The two tests here are the two halves of that. One: when the newer answer disagrees with what is
 * drawn, the recording is asked again. Two: when they agree, nothing is asked -- because a hook
 * that invalidated on every poll would refetch the recording, its transcript, its versions and
 * every list that draws a badge for it, four times a minute, forever.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { keys } from '@/api/keys';
import { createQueryClient } from '@/api/query-client';
import { LiveArchive } from '@/app/events';
import { REHEARSAL, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';
import { FakeEventSource, withEventSource, withoutEventSource } from '@/test/support/event-source';

import { useTranscriptionSettled, useTranscriptionStatus } from '../transcription';

mockApi();

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/**
 * A client holding a recording whose card says what the caller says.
 *
 * Seeded rather than fetched, because that is the situation: the card was drawn from a list
 * fetched a minute ago, and it is still inside its staleness window. Nothing will refetch it on
 * its own, which is exactly why somebody had to reload.
 */
function showing(state: string): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const recording = archive.recordings.find((one) => one.uuid === REHEARSAL);
  client.setQueryData([...keys.recording(REHEARSAL)], { ...recording, transcription_state: state });
  return client;
}

describe('a transcription that has moved on', () => {
  it('asks for the recording again when the newer answer disagrees with the card', async () => {
    // The instance says this one finished; the card on screen still says it is running. Arriving
    // at a recording from a stale list is this exact case, and there is no transition to catch --
    // the very first answer already disagrees.
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === REHEARSAL ? { ...one, transcription_state: 'done' } : one,
    );
    const client = showing('running');
    renderHook(() => useTranscriptionStatus(REHEARSAL, 'running'), { wrapper: wrapper(client) });

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(true);
    });
  });

  it('leaves the recording alone while the two agree', async () => {
    const client = showing('running');
    const { result } = renderHook(() => useTranscriptionStatus(REHEARSAL, 'running'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(result.current.data?.state).toBe('running');
    });
    expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(false);
  });

  it('asks the instance nothing about a recording that already has its transcript', () => {
    // `done` is the one state with nothing left to report, so the endpoint is not called at all.
    const client = showing('done');
    const { result } = renderHook(() => useTranscriptionStatus(REHEARSAL, 'done'), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(false);
  });
});

/**
 * The race the poll above cannot win, and the reason a finished transcription showed nothing.
 *
 * The status endpoint is asked every ten seconds and the recording every thirty, so either can be
 * the one that learns a job finished. When it is the recording, `transcription_state` flips to
 * `done`, that flip disables the status query, and the effect above never runs -- which left a
 * screen that had stopped saying "Transcribing" with a transcript it had fetched once, been
 * 404ed for, and never asked about again.
 */
describe('a recording that learned it first', () => {
  it('tells the cache when the state it is drawing changed under it', async () => {
    const client = showing('running');
    const { rerender } = renderHook(
      ({ state }: { state: string }) => {
        useTranscriptionSettled(REHEARSAL, state);
      },
      { wrapper: wrapper(client), initialProps: { state: 'running' } },
    );

    rerender({ state: 'done' });

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(true);
    });
  });

  it('says nothing on the first render, which is an arrival and not a change', async () => {
    const client = showing('done');
    renderHook(
      () => {
        useTranscriptionSettled(REHEARSAL, 'done');
      },
      { wrapper: wrapper(client) },
    );

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(false);
    });
  });

  it('says nothing when a poll comes back saying the same thing', async () => {
    // Every thirty seconds, forever, on an archive at rest. An invalidation per poll would
    // refetch the recording, its transcript, its versions and every list that draws a badge.
    const client = showing('done');
    const { rerender } = renderHook(
      ({ state }: { state: string }) => {
        useTranscriptionSettled(REHEARSAL, state);
      },
      { wrapper: wrapper(client), initialProps: { state: 'done' } },
    );

    rerender({ state: 'done' });

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(false);
    });
  });

  it('waits for the recording to arrive rather than treating its absence as a state', async () => {
    const client = showing('running');
    const { rerender } = renderHook<string | undefined, { state: string | undefined }>(
      ({ state }) => {
        useTranscriptionSettled(REHEARSAL, state);
        return state;
      },
      { wrapper: wrapper(client), initialProps: { state: undefined } },
    );

    rerender({ state: 'running' });

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(REHEARSAL)])?.isInvalidated).toBe(false);
    });
  });
});

describe('the poll, once the instance can say so itself', () => {
  /**
   * What the query would do next, asked of the options the hook actually installed.
   *
   * Through the resolved `refetchInterval` rather than by counting requests over fake timers:
   * the question is whether the interval is on, and a test that waits for a second request to
   * not arrive can only ever say "not yet".
   */
  function nextInterval(client: QueryClient): number | false {
    const found = client.getQueryCache().find({ queryKey: [...keys.transcription(REHEARSAL)] });
    // The cache's own view of a query is typed without the fetching options, which are the ones
    // being asked about here.
    const resolve = (found?.options as { refetchInterval?: unknown } | undefined)?.refetchInterval;
    expect(resolve).toBeTypeOf('function');
    const running = { state: { data: { state: 'running' } } };
    return (resolve as (one: unknown) => number | false)(running);
  }

  function framed(client: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          <LiveArchive>{children}</LiveArchive>
        </QueryClientProvider>
      );
    };
  }

  beforeEach(withEventSource);
  afterEach(withoutEventSource);

  it('keeps asking while nothing has told it anything', async () => {
    const client = showing('running');
    const view = renderHook(() => useTranscriptionStatus(REHEARSAL, 'running'), {
      wrapper: framed(client),
    });
    await waitFor(() => {
      expect(view.result.current.isFetched).toBe(true);
    });

    // The stream is open and has not connected, which is what a proxy that accepted the socket
    // and will never flush it looks like. The interval has to survive exactly that.
    expect(nextInterval(client)).toBe(10_000);
  });

  it('stands down while the instance is telling it', async () => {
    const client = showing('running');
    const view = renderHook(() => useTranscriptionStatus(REHEARSAL, 'running'), {
      wrapper: framed(client),
    });
    await waitFor(() => {
      expect(view.result.current.isFetched).toBe(true);
    });

    FakeEventSource.latest().open();

    await waitFor(() => {
      expect(nextInterval(client)).toBe(false);
    });
  });
});
