/**
 * How cached data behaves (`UI-3c`).
 *
 * Three decisions, taken once here rather than per query.
 *
 * **A refused request is not retried.** A 401, a 404 or a 409 is an answer, and asking three more
 * times cannot change it -- it only delays the moment somebody is told. A 5xx or an instance that
 * did not answer is worth retrying, because those genuinely pass.
 *
 * **A 401 is not a failure of the query, it is the end of the session.** Every view would
 * otherwise grow the same `if (problem.isUnauthenticated)`, so it is turned into one event here
 * and `UI-4a`'s guard is what answers it.
 *
 * **Data is fresh for a moment and then stale.** Long enough that opening a recording and coming
 * back does not refetch the list, short enough that a transcription finishing elsewhere shows up
 * when the window is looked at again.
 */

import { QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiProblem } from './problem';

/** How long a fetched thing is treated as current. */
export const STALE_AFTER_MS = 30_000;

/** How long an unused thing stays cached before it is dropped. */
export const FORGET_AFTER_MS = 5 * 60_000;

/** How many times a request that could plausibly succeed is repeated. */
export const RETRIES = 2;

/** What the interface does when the instance says there is no session. */
export type SessionEnded = () => void;

/**
 * Whether asking again could give a different answer.
 *
 * Anything the instance refused deliberately is final. A `409` looks retryable and is not: it
 * means somebody else already did the thing, and repeating the request re-asks a question that
 * has been answered.
 */
export function worthRetrying(failures: number, error: unknown): boolean {
  if (failures >= RETRIES) return false;
  if (error instanceof ApiProblem) return error.isUnreachable || error.status >= 500;
  return true;
}

export function createQueryClient(onSessionEnded?: SessionEnded): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiProblem && error.isUnauthenticated) onSessionEnded?.();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: STALE_AFTER_MS,
        gcTime: FORGET_AFTER_MS,
        retry: worthRetrying,
        // The window regaining focus is the cheapest signal that time has passed -- somebody
        // came back to a tab after a transcription ran. Reconnecting is the same argument.
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        // Refetching on every mount would make the sidebar reload each time a route changed,
        // which is exactly the flicker the staleness window exists to avoid.
        refetchOnMount: false,
      },
      mutations: {
        // A write is never repeated on its own. Whether asking twice is safe is a question about
        // the endpoint, and the interface does not get to assume the answer.
        retry: false,
      },
    },
  });
}
