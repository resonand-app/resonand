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
import { describe, expect, it } from 'vitest';

import { keys } from '@/api/keys';
import { createQueryClient } from '@/api/query-client';
import { CANCONS, archive } from '@/test/api/archive';
import { mockApi } from '@/test/api/server';

import { useTranscriptionStatus } from '../transcription';

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
  const recording = archive.recordings.find((one) => one.uuid === CANCONS);
  client.setQueryData([...keys.recording(CANCONS)], { ...recording, transcription_state: state });
  return client;
}

describe('a transcription that has moved on', () => {
  it('asks for the recording again when the newer answer disagrees with the card', async () => {
    // The instance says this one finished; the card on screen still says it is running. Arriving
    // at a recording from a stale list is this exact case, and there is no transition to catch --
    // the very first answer already disagrees.
    archive.recordings = archive.recordings.map((one) =>
      one.uuid === CANCONS ? { ...one, transcription_state: 'done' } : one,
    );
    const client = showing('running');
    renderHook(() => useTranscriptionStatus(CANCONS, 'running'), { wrapper: wrapper(client) });

    await waitFor(() => {
      expect(client.getQueryState([...keys.recording(CANCONS)])?.isInvalidated).toBe(true);
    });
  });

  it('leaves the recording alone while the two agree', async () => {
    const client = showing('running');
    const { result } = renderHook(() => useTranscriptionStatus(CANCONS, 'running'), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(result.current.data?.state).toBe('running');
    });
    expect(client.getQueryState([...keys.recording(CANCONS)])?.isInvalidated).toBe(false);
  });

  it('asks the instance nothing about a recording that already has its transcript', () => {
    // `done` is the one state with nothing left to report, so the endpoint is not called at all.
    const client = showing('done');
    const { result } = renderHook(() => useTranscriptionStatus(CANCONS, 'done'), {
      wrapper: wrapper(client),
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.getQueryState([...keys.recording(CANCONS)])?.isInvalidated).toBe(false);
  });
});
