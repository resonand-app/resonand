/**
 * The cache's rules (`UI-3c`).
 *
 * Three things are worth a test here and the rest is TanStack's own: that a refusal is not
 * retried, that a list knows its height before it has its rows, and that a change invalidates
 * what it should and nothing else.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { invalidate, staleAfter } from './invalidate';
import { keys } from './keys';
import { usePaged } from './paged';
import { ApiProblem } from './problem';
import { RETRIES, createQueryClient, worthRetrying } from './query-client';

function problem(status: number): ApiProblem {
  return new ApiProblem({ type: '/errors/x', title: 'T', detail: 'A sentence.', status });
}

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** A client that does not retry or cache between tests. */
function testClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0, gcTime: 0 } });
  return client;
}

describe('what is worth asking twice', () => {
  it('does not repeat a refusal', () => {
    // A 401, a 404 or a 409 is an answer. Asking again only delays telling somebody.
    for (const status of [400, 401, 403, 404, 409, 422]) {
      expect(worthRetrying(0, problem(status))).toBe(false);
    }
  });

  it('repeats a failure that could genuinely pass next time', () => {
    expect(worthRetrying(0, problem(500))).toBe(true);
    expect(worthRetrying(0, problem(502))).toBe(true);
    expect(worthRetrying(0, problem(0))).toBe(true);
  });

  it('gives up after a fixed number of attempts', () => {
    expect(worthRetrying(RETRIES, problem(500))).toBe(false);
  });

  it('reports the end of a session once, rather than in every view', async () => {
    const ended = vi.fn();
    const client = createQueryClient(ended);
    client.setDefaultOptions({ queries: { retry: false } });
    await client
      .query({ queryKey: keys.me(), queryFn: () => Promise.reject(problem(401)) })
      .catch(() => undefined);
    expect(ended).toHaveBeenCalledTimes(1);
  });
});

describe('a page of a collection', () => {
  const page = { items: ['a', 'b'], total: 537, limit: 50, offset: 0 };

  it('reports how tall the list is, not how many rows arrived', async () => {
    // UI-7 virtualises the dense list, so it has to know the height before it has the rows.
    const client = testClient();
    const { result } = renderHook(
      () => usePaged(keys.search({ q: 'x' }), () => Promise.resolve(page)),
      {
        wrapper: wrapper(client),
      },
    );
    await waitFor(() => {
      expect(result.current.total).toBe(537);
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('is empty and knows nothing before the first page arrives', () => {
    const client = testClient();
    const { result } = renderHook(
      () => usePaged(keys.search({ q: 'y' }), () => new Promise<typeof page>(() => undefined)),
      { wrapper: wrapper(client) },
    );
    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.hasMore).toBe(false);
  });

  it('says when a whole collection is on one page', async () => {
    const client = testClient();
    const { result } = renderHook(
      () =>
        usePaged(keys.search({ q: 'z' }), () =>
          Promise.resolve({ items: ['a'], total: 1, limit: 50, offset: 0 }),
        ),
      { wrapper: wrapper(client) },
    );
    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });
});

describe('what a change makes stale', () => {
  it('reaches a library and everything under it through one prefix', () => {
    const stale = staleAfter({ kind: 'recording', recording: 'r', library: 'l' });
    expect(stale).toContainEqual(keys.library('l'));
    // Not the recordings key, the shares key and the categories key one at a time -- the prefix
    // is what makes a new view reading the same data need no edit here.
    expect(stale).not.toContainEqual(keys.libraryShares('l'));
  });

  it('touches both libraries when a recording moves', () => {
    // The library that lost it shows a count too, and is as likely to be the view on screen.
    const stale = staleAfter({ kind: 'recording-moved', recording: 'r', from: 'a', to: 'b' });
    expect(stale).toContainEqual(keys.library('a'));
    expect(stale).toContainEqual(keys.library('b'));
  });

  it('makes search stale whenever anything it indexes changes', () => {
    // Search reads titles, notes, tags and transcripts (DEC-13), so a stale result is a result
    // that opens a recording with another name on it.
    for (const change of [
      { kind: 'recording', recording: 'r' },
      { kind: 'library' },
      { kind: 'upload', library: 'l' },
      { kind: 'transcription', recording: 'r' },
    ] as const) {
      expect(staleAfter(change)).toContainEqual(keys.search());
    }
  });

  it('leaves alone what a change did not touch', () => {
    const stale = staleAfter({ kind: 'account' });
    expect(stale).toEqual([keys.me()]);
  });

  it('refetches what it marked stale, and only that', async () => {
    const client = testClient();
    const libraries = vi.fn(() => Promise.resolve(['one']));
    const account = vi.fn(() => Promise.resolve({ display_name: 'Gabriel' }));
    await client.query({ queryKey: keys.libraries(), queryFn: libraries });
    await client.query({ queryKey: keys.me(), queryFn: account });
    await invalidate(client, { kind: 'library' });
    expect(client.getQueryState(keys.libraries())?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.me())?.isInvalidated).toBe(false);
  });
});
