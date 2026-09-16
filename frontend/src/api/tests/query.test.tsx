/**
 * The cache's rules (`UI-3c`).
 *
 * Four things are worth a test here and the rest is TanStack's own: that a refusal is not
 * retried, that a list knows its height before it has its rows, that a change invalidates what it
 * should and nothing else, and that the mark it leaves on a view nobody is looking at is still
 * there when somebody looks.
 */

import { QueryClientProvider, partialMatchKey, useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { invalidate, staleAfter } from '../invalidate';
import { keys } from '../keys';
import { pollEvery, usePaged } from '../paged';
import { ApiProblem } from '../problem';
import {
  HANDLED,
  RETRIES,
  createQueryClient,
  worthRetrying,
  worthReporting,
} from '../query-client';

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

describe('a write that failed', () => {
  /** Run a mutation that fails, and answer what the client reported. */
  async function failing(meta?: Record<string, unknown>): Promise<string[]> {
    const said: string[] = [];
    const client = createQueryClient(undefined, (detail) => said.push(detail));
    await client
      .getMutationCache()
      .build(client, {
        mutationFn: () => Promise.reject(problem(409)),
        ...(meta === undefined ? {} : { meta }),
      })
      .execute(undefined)
      .catch(() => undefined);
    return said;
  }

  it('says so once, in the words the API wrote to be shown', async () => {
    // Most of the writes in this product had no `onError` at all, so most of them failed in
    // silence: a rename, a move and a category change all changed nothing and said nothing.
    expect(await failing()).toEqual(['A sentence.']);
  });

  it('stays quiet where the view shows the refusal itself', async () => {
    // Sign-in prints what was refused beside the fields it was refused for. A toast over it
    // would be a second answer to a question that has already been answered.
    expect(await failing(HANDLED)).toEqual([]);
  });

  it('leaves the end of a session to the guard that answers it', () => {
    // A 401 is not a failed write. `UI-4a` is already leaving for the sign-in screen.
    expect(worthReporting(problem(401), undefined)).toBe(false);
    expect(worthReporting(problem(409), undefined)).toBe(true);
    expect(worthReporting(problem(500), HANDLED)).toBe(false);
  });

  it('reports a failure that never reached the instance like any other', () => {
    expect(worthReporting(new Error('offline'), undefined)).toBe(true);
  });
});

describe('how often a growing collection asks again', () => {
  it('stretches the interval by the pages it holds, so the cost of asking stays flat', () => {
    // A refetch of an infinite query is every page it is holding, because the pages are a chain.
    // One page loaded is one request every two seconds; three pages must not be three.
    expect(pollEvery(2_000, 1)).toBe(2_000);
    expect(pollEvery(2_000, 3)).toBe(6_000);
  });

  it('treats a collection with nothing in it as one page rather than none', () => {
    expect(pollEvery(2_000, 0)).toBe(2_000);
  });

  it('leaves a list at rest alone however deep it is', () => {
    expect(pollEvery(false, 7)).toBe(false);
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

  it('reaches every autocomplete and not only the one that asked for nothing', () => {
    // A prefix match compares strings for equality, so `tags('')` is one query and not a family.
    // A recording whose tags changed has to reach the popover somebody typed `me` into.
    const stale = staleAfter({ kind: 'recording', recording: 'r' });
    expect(stale).toContainEqual(keys.allTags());
    expect(partialMatchKey(keys.tags('me'), keys.allTags())).toBe(true);
  });

  it('refetches what it marked stale, and only that', async () => {
    const client = testClient();
    const libraries = vi.fn(() => Promise.resolve(['one']));
    const account = vi.fn(() => Promise.resolve({ display_name: 'Alex Morgan' }));
    await client.query({ queryKey: keys.libraries(), queryFn: libraries });
    await client.query({ queryKey: keys.me(), queryFn: account });
    await invalidate(client, { kind: 'library' });
    expect(client.getQueryState(keys.libraries())?.isInvalidated).toBe(true);
    expect(client.getQueryState(keys.me())?.isInvalidated).toBe(false);
  });
});

/**
 * The other half of an invalidation, and the one that was missing (`UI-3c`).
 *
 * `invalidateQueries` can only refetch what is on screen. A recording renamed on its own screen
 * invalidates the library list behind it -- which is unmounted, so it is marked and not fetched --
 * and `refetchOnMount` is what decides whether the mark means anything when somebody navigates
 * back. With it off, nothing ever asked again and the card kept the old name until a reload.
 */
describe('a change made while the view it affects is not on screen', () => {
  it('is fetched again when that view comes back', async () => {
    const client = createQueryClient();
    const list = vi.fn(() => Promise.resolve(['old name']));
    const view = renderHook(() => useQuery({ queryKey: keys.libraryAudio('l'), queryFn: list }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1);
    });

    // Somebody opened a recording: the list is unmounted, and the rename lands on nothing.
    view.unmount();
    await invalidate(client, { kind: 'recording', recording: 'r', library: 'l' });
    expect(list).toHaveBeenCalledTimes(1);

    renderHook(() => useQuery({ queryKey: keys.libraryAudio('l'), queryFn: list }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
  });

  it('does not re-ask for something still fresh, which is what the window is for', async () => {
    const client = createQueryClient();
    const list = vi.fn(() => Promise.resolve(['rows']));
    const view = renderHook(() => useQuery({ queryKey: keys.libraryAudio('l'), queryFn: list }), {
      wrapper: wrapper(client),
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1);
    });

    view.unmount();
    const again = renderHook(() => useQuery({ queryKey: keys.libraryAudio('l'), queryFn: list }), {
      wrapper: wrapper(client),
    });

    await waitFor(() => {
      expect(again.result.current.data).toEqual(['rows']);
    });
    expect(list).toHaveBeenCalledTimes(1);
  });
});
