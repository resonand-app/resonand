/**
 * One version, written in six files (`INF-12`).
 *
 * Four of the six are generated, so a bump done by hand reaches some of them and not the rest --
 * and the checks that notice never say so. `resonand openapi --check` reports that the published
 * document differs from the snapshot; `npm ci` reports a lock file out of sync with its manifest.
 * Neither mentions a version, and the two that nothing checks at all are the ones a person reads:
 * `resonand version`, and the About line the interface draws from `GET /instance`.
 *
 * This reads the files off disk, the backend's included, because agreement across the two halves
 * is the property under test and no import crosses them. `scripts/release.sh` is what sets all
 * six at once, which is why its absence fails here too.
 */

import { readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(relative: string): string {
  return readFileSync(resolve(ROOT, relative), 'utf8');
}

/** The first capture of `pattern` in `relative`, or a failure naming both. */
function captured(relative: string, pattern: RegExp): string {
  const found = pattern.exec(read(relative))?.[1];
  if (found === undefined) {
    throw new Error(`${relative}: nothing matched ${String(pattern)}`);
  }
  return found;
}

/** A string at `path` inside a JSON file, or a failure naming where it was looked for. */
function atPath(relative: string, ...path: string[]): string {
  let cursor: unknown = JSON.parse(read(relative));
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) {
      throw new Error(
        `${relative}: ${path.join('.')} runs through something that is not an object`,
      );
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  if (typeof cursor !== 'string') {
    throw new Error(`${relative}: ${path.join('.')} is not a string`);
  }
  return cursor;
}

/**
 * Every place the version is written, and how to read it out.
 *
 * `package-lock.json` appears twice on purpose: npm writes the root package's version at the top
 * level and again under `packages[""]`, and an edit that reaches one of them is an install that
 * fails rather than an inconsistency somebody notices later.
 */
const SOURCES: Record<string, () => string> = {
  'backend/pyproject.toml': () =>
    captured('backend/pyproject.toml', /\[project\][\s\S]*?\nversion = "([^"]+)"/),
  'backend/resonand/__init__.py': () =>
    captured('backend/resonand/__init__.py', /^__version__ = "([^"]+)"/m),
  'backend/uv.lock': () => captured('backend/uv.lock', /\nname = "resonand"\nversion = "([^"]+)"/),
  'frontend/package.json': () => atPath('frontend/package.json', 'version'),
  'frontend/package-lock.json': () => atPath('frontend/package-lock.json', 'version'),
  'frontend/package-lock.json (packages[""])': () =>
    atPath('frontend/package-lock.json', 'packages', '', 'version'),
  'frontend/src/api/contract/openapi.json': () =>
    atPath('frontend/src/api/contract/openapi.json', 'info', 'version'),
};

describe('the version is one number', () => {
  it('is the same in every file that carries it', () => {
    const found = Object.fromEntries(
      Object.entries(SOURCES).map(([where, readIt]) => [where, readIt()]),
    );
    const distinct = [...new Set(Object.values(found))];
    expect(distinct, `the version disagrees:\n${JSON.stringify(found, null, 2)}`).toHaveLength(1);
  });

  it('is set by one command rather than by hand', () => {
    const script = resolve(ROOT, 'scripts/release.sh');
    expect(statSync(script).isFile()).toBe(true);
    // Executable by its owner. A release script somebody has to remember to `bash` is one that
    // gets run some other way on the day it matters.
    expect(statSync(script).mode & 0o100).toBeGreaterThan(0);
  });
});
