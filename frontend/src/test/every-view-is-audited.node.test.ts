/**
 * 🧪 A new view without an audit fails CI (`UI-23a`).
 *
 * This is the half of `UI-23a` that is not about accessibility at all. `accessibility.test.tsx`
 * walks `VIEWS` and audits each one, and it would go on passing forever after somebody adds a
 * ninth screen -- a list of eight things, all eight of them fine. The criterion written next to
 * the task is not "the views pass axe" but *a new view without one fails CI*, and only a check
 * on the shape of the repository can say that.
 *
 * So: every view module on disk must appear in `VIEWS`. The other direction is asserted too, so
 * an entry left behind by a deleted view fails rather than quietly auditing nothing -- the same
 * rule `egress-disclosure.node.test.ts` follows, and for the same reason: a list that is allowed
 * to drift in either direction is a list that stops describing the repository.
 *
 * `views.tsx` is read as **text** rather than imported. A `*.node.test.ts` belongs to
 * `tsconfig.node.json`, which has no DOM and no `@/` alias on purpose -- the browser half of the
 * codebase is deliberately out of reach here -- and the harness pulls in React, the router and
 * every view behind it. Reading the list is also the more honest check: what has to be true is
 * that the literal table in that file names every view, and that is what this asserts.
 *
 * A view is `src/features/<feature>/<Something>View.tsx`. That is a convention rather than a law,
 * which is exactly why it is worth pinning: it is the convention all eight follow, and a ninth
 * that follows it is caught here automatically. One that does not is caught by the router,
 * because the harness mounts `AppRoutes` and an unrouted view is not a view anybody can reach.
 */

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every view module the application ships, by its path relative to `src/`. */
function onDisk(): string[] {
  return globSync('features/*/*View.tsx', { cwd: SOURCE })
    .map((path) => path.split('\\').join('/'))
    .filter((path) => !path.includes('.test.'))
    .sort();
}

/**
 * Every module `VIEWS` claims to audit.
 *
 * The `module:` field exists for this and nothing else, which is why it can be matched with a
 * pattern this plain: it is the one place in the harness where a path is written down.
 */
function audited(): string[] {
  const harness = readFileSync(resolve(SOURCE, 'test/support/views.tsx'), 'utf8');
  return [...harness.matchAll(/^\s*module:\s*'([^']+)',$/gm)].map((match) => match[1] ?? '').sort();
}

describe('the audited list and the views on disk', () => {
  it('names every view that exists, and no view that does not', () => {
    expect(audited()).toEqual(onDisk());
  });

  it('found the list at all, so a passing run is not two empty arrays', () => {
    expect(audited().length).toBeGreaterThan(0);
  });
});
