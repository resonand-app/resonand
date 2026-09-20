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
 * The exemption list is the interesting half, and it is **empty as of `UI-33a`**. It held the two
 * colours that predated the guard, and both directions are asserted: an unlisted bypass fails, and
 * **a listed one that no longer exists fails as well**. That second half is what emptied it -- the
 * commit that fixed the two could not land while its own excuses were still here, which is what
 * stops an exemption list becoming a place to put things.
 */

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import eslintConfig from '../../eslint.config.js';
import { findBypasses, KNOWN_BYPASSES } from '../../scripts/token-adherence.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SYSTEM = resolve(ROOT, 'design-system');
const APP = resolve(ROOT, 'src');

/** Every source file under a root. Not the tests, and not the CSS -- colours live in the CSS. */
function sourcesUnder(root: string): { path: string; source: string }[] {
  return globSync('**/*.{ts,tsx}', { cwd: root })
    .filter((path) => !path.includes('.test.'))
    .sort()
    .map((path) => ({
      path: path.split('\\').join('/'),
      source: readFileSync(resolve(root, path), 'utf8'),
    }));
}

/** The system, which is where the colour and font rules stop. */
function sources(): { path: string; source: string }[] {
  return sourcesUnder(SYSTEM);
}

/**
 * The system and the application both, which is how far the type rule reaches (`UI-33a1`).
 *
 * The generated contract is excluded because nobody writes it: `sonarium openapi` produces one
 * half and `npm run api:types` the other, and the only available fix for a finding in either
 * would be to stop generating it.
 */
function typedSources(): { path: string; source: string }[] {
  return [
    ...sources().map((file) => ({ ...file, path: `design-system/${file.path}` })),
    ...sourcesUnder(APP)
      .filter((file) => !file.path.startsWith('api/contract/'))
      .map((file) => ({ ...file, path: `src/${file.path}` })),
  ];
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
        if (found.kind === 'type') continue;
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
    expect(kinds("const a = { fontFamily: 'Geist, sans-serif' };")).toEqual([
      'Geist',
      'sans-serif',
    ]);
    // The generic families are in the pattern because `fontFamily` is the one type property the
    // type rule does not read: a family is a name wherever it is written, so it stays here.
    expect(kinds("const a = { fontFamily: 'serif' };")).toEqual(['serif']);
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

  it('names a task for any bypass still excused', () => {
    // Empty since `UI-33a`. An entry added later is a promise that it will be removed again, and
    // a promise with no identifier on it is one nobody can pick up.
    for (const entry of KNOWN_BYPASSES) expect(entry.why).toMatch(/\bUI-\d/);
  });

  it('excuses only files that are there', () => {
    for (const entry of KNOWN_BYPASSES) {
      expect(sources().map((file) => file.path)).toContain(entry.file);
      expect(relative(SYSTEM, resolve(SYSTEM, entry.file)).startsWith('..')).toBe(false);
    }
  });
});

describe('the type scale guard', () => {
  // `UI-33a` fixed six values and `UI-33a1` found eight more, because the guard read colour and
  // font and a leading is neither. What is asserted here is the widening rather than the eight
  // edits: a rule that holds only while somebody remembers it is what produced the second entry.

  const kinds = (source: string) =>
    findBypasses(source)
      .filter((found) => found.kind === 'type')
      .map((found) => found.value);

  it('finds the system and the application, not an empty list', () => {
    expect(typedSources().length).toBeGreaterThan(100);
    expect(typedSources().map((file) => file.path)).toContain('src/components/MoveDialog.tsx');
  });

  it('finds no raw type value in either tree', () => {
    const offences: string[] = [];
    for (const { path, source } of typedSources()) {
      for (const found of findBypasses(source)) {
        if (found.kind === 'type') offences.push(`${path}:${String(found.line)} ${found.value}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it('catches a bare leading, a raw tracking, a size and a ternary of weights', () => {
    // The eight `UI-33a1` found, one of each shape they were written in.
    expect(kinds('const a = { lineHeight: 1.45 };')).toEqual(['lineHeight: 1.45']);
    expect(kinds("const a = { letterSpacing: '-0.005em' };")).toEqual([
      "letterSpacing: '-0.005em'",
    ]);
    expect(kinds("const a = { fontSize: '11px' };")).toEqual(["fontSize: '11px'"]);
    expect(kinds('const a = { fontWeight: active ? 600 : 400 };')).toEqual([
      'fontWeight: active ? 600 : 400',
    ]);
  });

  it('accepts a token, a token inside a calc, and the keywords that state no opinion', () => {
    expect(kinds("const a = { lineHeight: 'var(--type-ui-leading)' };")).toEqual([]);
    expect(kinds('const a = { fontSize: `calc(var(--type-wordmark-scale) * ${s}px)` };')).toEqual(
      [],
    );
    expect(
      kinds("const a = { fontWeight: x ? 'var(--weight-semibold)' : 'var(--weight-regular)' };"),
    ).toEqual([]);
    // `inherit` is how a row hands its tracking to the highlight inside it; `undefined` is how a
    // component declines to set the property at all. Neither is a value somebody chose.
    expect(kinds("const a = { letterSpacing: 'inherit' };")).toEqual([]);
    expect(kinds("const a = { letterSpacing: 'normal' };")).toEqual([]);
    expect(kinds('const a = { fontSize: undefined };')).toEqual([]);
  });

  it('does not call a spacing number a type value', () => {
    // `UI-33b` gave layout its own tokens and its own argument. A rule that flagged `gap: 3` here
    // would be answering that one badly on the way past.
    expect(kinds('const a = { padding: 8, gap: 3, maxWidth: 230, width: 12 };')).toEqual([]);
  });

  it('reads the property and not a comma inside the value', () => {
    expect(kinds("const a = { fontSize: 'clamp(1px, 2vw, 3px)', color: 'var(--text)' };")).toEqual([
      "fontSize: 'clamp(1px, 2vw, 3px)'",
    ]);
  });

  it('puts the type selectors in every block that restricts syntax', () => {
    // The trap this arrangement exists for: flat config **replaces** a rule's options rather than
    // merging them, so a second block matching one file silently switches the first one's
    // selectors off. Three blocks cover disjoint sets today; a fourth that forgot these would
    // take the guard off whatever it matched, and nothing else would say so.
    const blocks = (eslintConfig as { rules?: Record<string, unknown> }[]).filter(
      (entry) => entry.rules?.['no-restricted-syntax'] !== undefined,
    );
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    for (const block of blocks) {
      const selectors = (block.rules?.['no-restricted-syntax'] as [string, { selector: string }[]])
        .slice(1)
        .map((entry) => (entry as unknown as { selector: string }).selector);
      expect(selectors.some((selector) => selector.includes('lineHeight'))).toBe(true);
    }
  });
});
