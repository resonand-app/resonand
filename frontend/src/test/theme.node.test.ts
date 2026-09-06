/**
 * The two places that spell the theme out agree with each other (`UI-1j`).
 *
 * Two duplications exist by necessity, and this is the check that neither has drifted.
 *
 * The storage key is written in `index.html` as well as in the theme module, because the script
 * that prevents a flash of the wrong theme has to run before any module does and therefore cannot
 * import anything. And the light palette is written twice in `semantic.css`, because CSS has no
 * way to give one declaration block two conditions when one is a media query
 * (`prefers-color-scheme: light`, for somebody following the system) and the other is a selector
 * (`[data-theme="light"]`, for somebody who chose it).
 *
 * Editing one copy and not the other is the only way either goes wrong, so that is what is
 * asserted rather than trusted.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/**
 * The key as `theme.ts` spells it, read out of the source rather than imported.
 *
 * `theme.ts` belongs to tsconfig.app.json and this test does not: a `*.node.test.ts` reads the
 * repository from outside the application, and reaching into the app project's file list to do it
 * is how that boundary stops meaning anything. Reading the literal is also closer to the thing
 * under test, which is that two files spell one string the same way.
 */
function storageKeyInModule(): string {
  const declared = /THEME_STORAGE_KEY = '([^']+)'/.exec(read('design-system/theme/theme.ts'));
  expect(declared).not.toBeNull();
  return declared?.[1] ?? '';
}

/** The declarations inside a block, as `--name: value` lines, comments and indentation removed. */
function declarationsIn(css: string): string[] {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(';')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--'))
    .map((line) => line.replace(/\s+/g, ' '));
}

describe('the theme', () => {
  it('uses one storage key, in the module and in the pre-paint script', () => {
    const key = storageKeyInModule();
    expect(key).toBe('sonarium-theme');
    expect(read('index.html')).toContain(`localStorage.getItem('${key}')`);
  });

  it('applies the choice before the bundle loads, or there is a flash', () => {
    const html = read('index.html');
    // Both halves: the attribute the stylesheet selects on, and the `color-scheme` that makes the
    // browser's own chrome agree with the tokens.
    expect(html).toContain("setAttribute('data-theme', choice)");
    expect(html).toContain("setProperty('color-scheme', choice)");
    // Wrapped, because it throws rather than returning null wherever site data is blocked.
    expect(html).toMatch(/try \{[\s\S]*localStorage[\s\S]*\} catch/);
  });

  it('declares the light palette identically in both places', () => {
    const css = read('design-system/tokens/semantic.css');

    const systemBlock = /:root:not\(\[data-theme\]\) \{([\s\S]*?)\n {2}\}/.exec(css);
    const chosenBlock = /\n\[data-theme="light"\] \{([\s\S]*?)\n\}/.exec(css);
    expect(systemBlock).not.toBeNull();
    expect(chosenBlock).not.toBeNull();

    const system = declarationsIn(systemBlock?.[1] ?? '');
    const chosen = declarationsIn(chosenBlock?.[1] ?? '');
    expect(system.length).toBeGreaterThan(20);
    expect(system).toEqual(chosen);
  });

  it('guards the system block on the attribute being absent, not on its value', () => {
    // `:not([data-theme])` and not `:not([data-theme="dark"])`. Following the system is defined
    // as writing nothing, so the absence is what selects it -- and an attribute with any other
    // value would otherwise fall through to a palette nobody chose.
    const css = read('design-system/tokens/semantic.css');
    expect(css).toContain('@media (prefers-color-scheme: light) {');
    expect(css).toContain(':root:not([data-theme]) {');
  });
});
