/**
 * Two hundred recordings is two hundred requests (`UI-9b`, `UI-9c`, §3.5).
 *
 * The plan's mandatory test for this task is a run where a third fail, and that is the first one
 * below. What it has to prove is not that failures are caught but that the run is an outcome:
 * the successes stand, the failures are named with the API's own words, and nothing throws.
 */

import { describe, expect, it } from 'vitest';

import { ApiProblem } from '@/api/problem';

import { reasonsIn, runBulk } from '../bulk';

const problem = (detail: string, status = 409) =>
  new ApiProblem({ type: 'about:blank', title: 'Conflict', detail, status });

describe('a run where a third fail', () => {
  const uuids = Array.from({ length: 30 }, (_, index) => `r${String(index)}`);

  it('reports what worked and what did not, and does not reject', async () => {
    const outcome = await runBulk(uuids, (uuid) =>
      Number(uuid.slice(1)) % 3 === 0
        ? Promise.reject(problem('That recording is already in the trash.'))
        : Promise.resolve(undefined),
    );
    expect(outcome.succeeded).toHaveLength(20);
    expect(outcome.failed).toHaveLength(10);
  });

  it('leaves what worked alone rather than rolling it back', async () => {
    // Separate requests are separate facts. Undoing a hundred successful moves because the
    // hundred-and-first failed would be a hundred more requests and a worse state than either.
    const touched: string[] = [];
    const outcome = await runBulk(uuids, (uuid) => {
      touched.push(uuid);
      return Number(uuid.slice(1)) % 3 === 0
        ? Promise.reject(problem('No.'))
        : Promise.resolve(undefined);
    });
    expect(touched).toHaveLength(30);
    expect(outcome.succeeded.every((uuid) => touched.includes(uuid))).toBe(true);
  });

  it("keeps the API's own words for each failure", async () => {
    const outcome = await runBulk(['a'], () =>
      Promise.reject(problem('You cannot edit recordings in that library.')),
    );
    // §1.9: `detail` is written to be shown to a person, so it is carried rather than replaced.
    expect(outcome.failed[0]?.problem.detail).toBe('You cannot edit recordings in that library.');
  });

  it('reports in the order they were given, not the order they answered', async () => {
    const outcome = await runBulk(['a', 'b', 'c'], (uuid) =>
      uuid === 'a' ? new Promise((resolve) => setTimeout(resolve, 5)) : Promise.resolve(undefined),
    );
    // A report that reshuffles itself between runs is one nobody can compare to the last.
    expect(outcome.succeeded).toEqual(['a', 'b', 'c']);
  });
});

describe('a run where everything fails', () => {
  it('is an outcome rather than an exception', async () => {
    // A throw would make total failure the one case that skipped the panel the caller renders.
    const outcome = await runBulk(['a', 'b'], () => Promise.reject(problem('No.')));
    expect(outcome.succeeded).toEqual([]);
    expect(outcome.failed).toHaveLength(2);
  });

  it('reports something that was not an ApiProblem at all', async () => {
    const outcome = await runBulk(['a'], () => Promise.reject(new Error('the network went away')));
    expect(outcome.failed[0]?.problem.detail).toBe('the network went away');
  });
});

describe('how many run at once', () => {
  it('is bounded, because two hundred at once is a denial of service on one small machine', async () => {
    let inFlight = 0;
    let peak = 0;
    await runBulk(
      Array.from({ length: 50 }, (_, index) => String(index)),
      async () => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight -= 1;
      },
      4,
    );
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it('does not start four workers for one recording', async () => {
    let started = 0;
    await runBulk(['only'], () => {
      started += 1;
      return Promise.resolve(undefined);
    });
    expect(started).toBe(1);
  });
});

describe('the reasons', () => {
  it('groups identical ones and puts the commonest first', () => {
    // Two hundred failures with one cause is one thing to fix; two hundred identical lines is a
    // wall somebody scrolls past.
    const reasons = reasonsIn([
      { uuid: 'a', problem: problem('Locked.') },
      { uuid: 'b', problem: problem('Not yours.') },
      { uuid: 'c', problem: problem('Locked.') },
      { uuid: 'd', problem: problem('Locked.') },
    ]);
    expect(reasons).toEqual([
      { detail: 'Locked.', count: 3 },
      { detail: 'Not yours.', count: 1 },
    ]);
  });
});
