/**
 * Who is signed in (`UI-4a`).
 *
 * One query, cached under one key, so the sidebar, the profile menu, the settings view and the
 * guard are all reading the same answer rather than each asking for it. The session itself is a
 * cookie the interface never sees: signing in sets it, signing out clears it, and every request
 * carries it because it is same-origin (`UI-3b`).
 *
 * A 401 is not an error to render. It is the end of the session, and the query client turns it
 * into one event (`UI-3c`) which the guard answers by leaving for the sign-in screen.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, UseQueryResult } from '@tanstack/react-query';

import { get, post, remove } from '@/api/client';
import { keys } from '@/api/keys';
import { ApiProblem } from '@/api/problem';
import type { components } from '@/api/schema';

export type Account = components['schemas']['Me'];
export type Instance = components['schemas']['InstanceState'];

export interface Session {
  account: Account | undefined;
  /** Whether the answer is not back yet. Distinct from "there is no session". */
  isPending: boolean;
  /** Whether the instance says there is no session. */
  isSignedOut: boolean;
}

export function useSession(): Session {
  const query = useQuery({
    queryKey: keys.me(),
    queryFn: () => get('/api/auth/me'),
    // The session is the one thing worth re-reading when a tab is returned to: it may have been
    // revoked from another device since (`V10`).
    staleTime: 60_000,
  });
  return {
    account: query.data,
    isPending: query.isPending,
    isSignedOut: query.error instanceof ApiProblem && query.error.isUnauthenticated,
  };
}

/**
 * What this instance is, without a session.
 *
 * The only call made before signing in, and the one every view reads its facts from rather than
 * hard-coding them: how long the trash keeps things, how large an upload may be, and what an
 * upload may be (`API-14`, `UI-18a`).
 */
export function useInstance(): UseQueryResult<Instance> {
  return useQuery({
    queryKey: keys.instance(),
    queryFn: () => get('/api/instance'),
    // It changes when the instance is upgraded, which is not while somebody is looking at it.
    staleTime: 5 * 60_000,
  });
}

export function useSignIn() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      post('/api/auth/session', { body: credentials }),
    onSuccess: (account) => {
      arrive(client, account);
    },
  });
}

/**
 * What a new session does to everything cached.
 *
 * Everything is forgotten first, because on a shared machine what is cached belonged to somebody
 * else -- and only then is the account written in, so the first render after signing in has a
 * session rather than a request for one.
 */
function arrive(client: QueryClient, account: Account): void {
  client.clear();
  client.setQueryData(keys.me(), account);
}

/**
 * The first run: an account, and the session that comes with it (`UI-21b`).
 *
 * Separate from `useSignIn` rather than a flag on it, because they are different requests with
 * different bodies answered by different rules -- and the one moment an instance has nobody to
 * authorise a request is not a variant of signing in. What they share is the aftermath, so that
 * is what is shared: `arrive` seeds the cache the same way for both.
 */
export function useBootstrap() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (account: { email: string; password: string; display_name: string }) =>
      post('/api/auth/bootstrap', { body: account }),
    onSuccess: (account) => {
      arrive(client, account);
    },
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => remove('/api/auth/session'),
    onSettled: () => {
      // `onSettled` and not `onSuccess`: if signing out failed because the session was already
      // gone, staying signed in on this screen is the wrong answer to give.
      client.clear();
    },
  });
}
