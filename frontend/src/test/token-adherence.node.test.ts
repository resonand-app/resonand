/**
 * No component contains a colour (`UI-1i`).
 *
 * The rule the whole system rests on. It is what makes `[data-theme="light"]` a redefinition of
 * six tokens rather than a second stylesheet, what lets `UI-33c` audit AA contrast by checking
 * token pairs instead of grepping the tree, and what makes recolouring the product a change to
 * `tokens/colors.css` and nothing else.
 *
 * It is checked twice from one description in `scripts/token-adherence.mjs`: ESLint reads those
 * patterns so the failure arrives while the hex is being typed, and this reads them so it arrives
 * in CI too, on a machine where nobody ran an editor. `UI-1i`'s criterion is that introducing
 * `#FF0000` into a component fails two checks, and these are the two.
 *
 * The exemption list is the interesting half. Two bypasses already exist and `UI-33a` is the task
 * that removes them, so the guard has to land against code that breaks it. Both directions are
 * asserted: an unlisted bypass fails, and **a listed one that no longer exists fails as well**.
 * That second half is what stops the list becoming a place to put things -- it can only shrink,
 * and the commit that fixes a bypass is forced to delete its own excuse.
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { findBypasses, KNOWN_BYPASSES } from '../../scripts/token-adherence.mjs';

const SYSTEM = resolve(dirname(fileURLToPath(import.meta.url)), '../../design-system');

/** Every source file of the system. Not the tests, and not the CSS -- colours live in the CSS. */
function sources(): { path: string; source: string }[] {
  return globSync('**/*.{ts,tsx}', { cwd: SYSTEM })
    .filter((path) => !path.includes('.test.'))
    .sort()
    .map((path) => ({
      path: path.split('\\').join('/'),
      source: readFileSync(resolve(SYSTEM, path), 'utf8'),
    }));
}

describe('the tokens-only guard', () => {
  it('finds the system, not an empty list', () => {
    // Every assertion below passes against zero files, which is the one way this could be
    // reassuring and useless at the same time.
    expect(sources().length).toBeGreaterThan(20);
  });

  it('finds no colour and no font stack that is not already excused', () => {
    const excused = new Set(KNOWN_BYPASSES.map((entry) => `${entry.file} ${entry.value}`));
    const offences: string[] = [];
    for (const { path, source } of sources()) {
      for (const found of findBypasses(source)) {
        const key = `${path} ${found.value}`;
        if (!excused.has(key)) offences.push(`${path}:${String(found.line)} ${found.value}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('holds no excuse for something that is already fixed', () => {
    const present = new Set<string>();
    for (const { path, source } of sources()) {
      for (const found of findBypasses(source)) present.add(`${path} ${found.value}`);
    }
    const stale = KNOWN_BYPASSES.filter((entry) => !present.has(`${entry.file} ${entry.value}`));
    expect(stale).toEqual([]);
  });

  it('catches a hex colour, an rgb(), an hsl() and a font stack', () => {
    // Verified against the thing it prevents rather than against the tree it happens to be run
    // on -- the tree is currently clean, so every assertion above passes with a broken matcher.
    const kinds = (source: string) => findBypasses(source).map((found) => found.value);
    expect(kinds("const a = { color: '#FF0000' };")).toEqual(['#FF0000']);
    expect(kinds("const a = { color: '#fff' };")).toEqual(['#fff']);
    expect(kinds("const a = { background: 'rgb(1, 2, 3)' };")).toEqual(['rgb(1, 2, 3)']);
    expect(kinds("const a = { background: 'hsla(1, 2%, 3%, .4)' };")).toEqual([
      'hsla(1, 2%, 3%, .4)',
    ]);
    expect(kinds("const a = { fontFamily: 'Geist, sans-serif' };")).toEqual(['Geist']);
  });

  it('does not call a fragment reference a colour', () => {
    // `url(#wave-3f2a)` is how the waveform clips its played half. A rule that flagged it is a
    // rule somebody turns off within a week.
    expect(findBypasses('const a = `url(#wave-${id})`;')).toEqual([]);
    expect(findBypasses("const a = 'url(#wave-3f2a)';")).toEqual([]);
  });

  it('reads rules and not prose', () => {
    // The exemption list explains itself by naming `#C4574A`, and this file names `#FF0000`.
    expect(findBypasses('/* #FF0000 is what this prevents. */\nconst a = 1;')).toEqual([]);
    expect(findBypasses('// Geist is the interface font.\nconst a = 1;')).toEqual([]);
  });

  it('names the task that removes each remaining bypass', () => {
    expect(KNOWN_BYPASSES.length).toBeGreaterThan(0);
    for (const entry of KNOWN_BYPASSES) expect(entry.why).toContain('UI-33a');
  });

  it('excuses only files that are there', () => {
    for (const entry of KNOWN_BYPASSES) {
      expect(sources().map((file) => file.path)).toContain(entry.file);
      expect(relative(SYSTEM, resolve(SYSTEM, entry.file)).startsWith('..')).toBe(false);
    }
  });
});
