/**
 * Two hundred recordings is two hundred requests (`UI-9b`, `UI-9c`, §V3, §3.5).
 *
 * There is no bulk endpoint, and that is not an oversight to be worked around: every one of these
 * actions is a permission check and an audit trail per recording, and an endpoint that took a list
 * would have to invent an answer for the case where half of them are refused. The interface makes
 * the same list of requests the API would have, and reports the same partial answer.
 *
 * So **partial failure is the designed outcome rather than an error case**. Three properties come
 * out of that:
 *
 * **What worked is not undone.** These are separate requests and separate facts; rolling back a
 * hundred successful moves because the hundred-and-first failed would be a hundred more requests
 * and a worse state than either.
 *
 * **The failures stay selected**, which is what makes Retry one click rather than a reconstruction
 * of what somebody had picked (`retain` in `selection.ts`).
 *
 * **Concurrency is bounded.** Two hundred simultaneous requests is a self-inflicted denial of
 * service on an instance that is, by design, one small machine somebody owns -- and the browser
 * would queue them anyway, six at a time, in an order nobody chose. Four at a time is fast enough
 * that a hundred recordings is a few seconds, and slow enough that the instance stays answerable
 * to the person waiting for it.
 */

import { ApiProblem, isApiProblem } from '@/api/problem';

/** How many requests are in flight at once. */
export const CONCURRENCY = 4;

export interface Failure {
  uuid: string;
  /** Why, as the API said it -- `detail` is written to be shown to a person (§1.9). */
  problem: ApiProblem;
}

export interface Outcome {
  succeeded: string[];
  failed: Failure[];
}

/**
 * Do one thing to each of them, and say what happened.
 *
 * It never rejects. A run where everything failed is an outcome and not an exception: the caller
 * has to render the same panel either way, and a throw would make the total failure the one case
 * that skipped it.
 */
export async function runBulk(
  uuids: readonly string[],
  action: (uuid: string) => Promise<unknown>,
  concurrency: number = CONCURRENCY,
): Promise<Outcome> {
  const queue = [...uuids];
  const succeeded: string[] = [];
  const failed: Failure[] = [];

  async function worker() {
    for (;;) {
      const uuid = queue.shift();
      if (uuid === undefined) return;
      try {
        await action(uuid);
        succeeded.push(uuid);
      } catch (cause) {
        failed.push({
          uuid,
          problem: isApiProblem(cause)
            ? cause
            : // Anything that is not one of ours still has to be reportable per recording, and
              // `ApiProblem` is the shape every part of the interface knows how to show.
              new ApiProblem({
                type: 'about:blank',
                title: 'Error',
                detail: cause instanceof Error ? cause.message : String(cause),
                status: 0,
              }),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker),
  );

  // In the order they were given, not the order they finished: a report that reshuffles itself
  // between runs is a report nobody can compare to the last one.
  const order = new Map(uuids.map((uuid, index) => [uuid, index]));
  succeeded.sort((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0));
  failed.sort((left, right) => (order.get(left.uuid) ?? 0) - (order.get(right.uuid) ?? 0));

  return { succeeded, failed };
}

/**
 * The one sentence a run of these gets.
 *
 * Grouped by what went wrong rather than listed per recording: two hundred failures with one
 * cause is one thing to fix, and two hundred identical lines is a wall somebody scrolls past.
 */
export function reasonsIn(failures: readonly Failure[]): { detail: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const failure of failures) {
    counts.set(failure.problem.detail, (counts.get(failure.problem.detail) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([detail, count]) => ({ detail, count }))
    .sort((left, right) => right.count - left.count);
}
