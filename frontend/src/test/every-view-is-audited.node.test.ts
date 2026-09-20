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
 *
 * **And a view is not the only surface** (`UI-23a1`). A route is what a URL lands on; an overlay
 * is what a click raises, and a settings section is what a query parameter selects. Neither is
 * a `*View.tsx`, so for as long as this file checked only the first kind, the criterion was met
 * for eight screens and silently unmet for the dozen behind them -- while `views.tsx` said in
 * its own comment that the dialogs were audited where they were raised. Two more checks, on the
 * same principle as the first: every overlay that exists must be named by a state, and every
 * section must be reached by one.
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
  return [...harness().matchAll(/^\s*module:\s*'([^']+)',$/gm)]
    .map((match) => match[1] ?? '')
    .sort();
}

/** The harness, as text. */
function harness(): string {
  return readFileSync(resolve(SOURCE, 'test/support/views.tsx'), 'utf8');
}

/**
 * Every module that draws an overlay, by its path relative to `src/`.
 *
 * `Modal` and `TypedConfirm` are the two primitives the system has for putting something over
 * the page, so a module that mounts one is a surface somebody can be looking at -- and the file
 * that mounts it is the one worth naming, not the several that raise it. `UploadDialog` is
 * raised twice by the shell, once for each of the two layouts, and it is one thing to audit.
 *
 * `dev/` is excluded for the reason it is excluded from the token guard: it is the specimen page
 * and it ships to nobody.
 */
function overlaysOnDisk(): string[] {
  return globSync('**/*.tsx', { cwd: SOURCE })
    .map((path) => path.split('\\').join('/'))
    .filter(
      (path) =>
        !path.includes('.test.') && !path.startsWith('dev/') && !path.split('/').includes('tests'),
    )
    .filter((path) =>
      /<(Modal|TypedConfirm)[\s>]/.test(readFileSync(resolve(SOURCE, path), 'utf8')),
    )
    .sort();
}

/** Every overlay `STATES` claims to raise. `draws:` exists for this and nothing else. */
function overlaysAudited(): string[] {
  return [...harness().matchAll(/^\s*draws:\s*'([^']+)',$/gm)]
    .map((match) => match[1] ?? '')
    .sort();
}

/**
 * The section a bare `/settings` draws, which `V10` in `VIEWS` already audits.
 *
 * `sectionIn` falls back to it for an unknown section and for Administration asked for by
 * somebody who is not an administrator, so it is the one section reachable without naming it.
 */
const DEFAULT_SECTION = 'account';

/** Every section Settings has, read out of the tuple that defines them. */
function sectionsOnDisk(): string[] {
  const source = readFileSync(resolve(SOURCE, 'features/settings/sections.ts'), 'utf8');
  const tuple = /export const SECTIONS = \[([^\]]*)\]/.exec(source);
  if (tuple === null) throw new Error('SECTIONS is not where this test expects it.');
  return [...(tuple[1] ?? '').matchAll(/'([a-z]+)'/g)].map((match) => match[1] ?? '').sort();
}

/** Every section a state mounts, which is every section but the one a bare URL gives. */
function sectionsAudited(): string[] {
  return [
    ...new Set(
      [...harness().matchAll(/\$\{SECTION_PARAM\}=([a-z]+)/g)].map((match) => match[1] ?? ''),
    ),
  ].sort();
}

describe('the audited list and the views on disk', () => {
  it('names every view that exists, and no view that does not', () => {
    expect(audited()).toEqual(onDisk());
  });

  it('found the list at all, so a passing run is not two empty arrays', () => {
    expect(audited().length).toBeGreaterThan(0);
  });
});

describe('the audited list and the overlays on disk', () => {
  it('names every overlay that exists, and no overlay that does not', () => {
    expect(overlaysAudited()).toEqual(overlaysOnDisk());
  });

  it('found some at all, so a passing run is not two empty arrays', () => {
    expect(overlaysAudited().length).toBeGreaterThan(0);
  });
});

describe('the audited list and the settings sections', () => {
  it('reaches every section but the one a bare URL already gives', () => {
    expect(sectionsAudited()).toEqual(sectionsOnDisk().filter((one) => one !== DEFAULT_SECTION));
  });

  it('still has a section it does not have to name, so the exception is a real one', () => {
    expect(sectionsOnDisk()).toContain(DEFAULT_SECTION);
  });
});
