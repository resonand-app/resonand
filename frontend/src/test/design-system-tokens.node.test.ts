/**
 * `tokens.ts` says what the CSS says (`UI-1c`).
 *
 * The seven files in `design-system/tokens/` are the source of truth and `tokens.ts` is a
 * restatement of their names for the type checker. Two descriptions of one thing drift, so this
 * is the check that they have not: it runs the generator's own reader over the CSS and compares
 * the result to the committed file, which makes a forgotten `npm run tokens` a failed test
 * rather than a token the compiler has never heard of.
 *
 * It compares the rendered file rather than importing `TOKENS` and checking the array. Two
 * reasons, and the second is the real one. Comparing the file catches a change to the
 * generator's output shape as well as to the token list, and either one leaves the repository
 * holding a file nobody could reproduce. And `tokens.ts` belongs to tsconfig.app.json, which
 * this test does not: a `*.node.test.ts` reads the repository from outside the application, and
 * reaching into the app project's file list to do it is how that boundary stops meaning
 * anything.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { declaredTokens, render, tokensIn } from '../../scripts/generate-tokens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED = resolve(HERE, '../../design-system/tokens.ts');

describe('the token union', () => {
  it('is what `npm run tokens` would write today', () => {
    expect(readFileSync(GENERATED, 'utf8').trim()).toBe(render(declaredTokens()).trim());
  });

  it('carries the semantic aliases every component reaches for', () => {
    // A spot check, because the assertion above passes just as happily against two empty lists.
    // A stray brace or a comment syntax the reader does not know would empty it silently, and
    // the first failure would then be a component with no colour in it at all.
    const names = declaredTokens();
    for (const name of ['--bg', '--surface', '--text', '--accent', '--wave', '--radius-panel']) {
      expect(names).toContain(name);
    }
    expect(names.length).toBeGreaterThan(100);
  });

  it('reads declarations and not uses', () => {
    // `--bg: var(--ink-900)` is a declaration and a use on one line, and `semantic.css` is
    // ninety of them. A reader that took both would put every `var()` into the union, including
    // names nothing defines -- which is the failure that would look most like success.
    const css = `
      /* --commented-out: never declared. */
      :root { --declared: var(--used); --second: 4px; }
      [data-theme="light"] { --declared: var(--other-used); }
    `;
    expect(tokensIn(css)).toEqual(['--declared', '--second']);
  });
});
