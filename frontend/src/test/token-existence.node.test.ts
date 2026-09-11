/**
 * Every `var(--name)` in the tree names a token that exists (`UI-1c`).
 *
 * `tokens.ts` makes `token('--surfce')` a compile error, but almost nothing calls `token()`:
 * the components write `var(--surface)` inside an inline style, which is a string, and a string
 * the compiler will never look at. So the union guarded the door nobody used.
 *
 * What got through it: `--radius-card`, `--surface-1`, `--text-1`, `--border-1`, `--border-2`,
 * `--space-5`, `--space-10`, `--danger`, `--type-meta-size`, `--tracking-meta`,
 * `--hairline-strong`, `--surface-3` and `font: var(--type-title)`. Every one of them resolved
 * to nothing, and CSS drops an invalid declaration in silence -- which is why Administration's
 * four sections had square corners and no border, and why every error message in the product
 * was rendering in the inherited colour instead of red. Nothing failed. It just looked slightly
 * wrong in twenty places.
 *
 * A `var()` with a fallback is exempt: `var(--maybe, 12px)` is a deliberate default, and the
 * second argument is what makes it safe. Comments are stripped first, for the same reason
 * `tokensIn` strips them: prose about a token is not a use of one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { declaredTokens } from '../../scripts/generate-tokens.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * The files that write CSS: the application, and the design system minus its own token
 * declarations. `tokens/` is the source of truth and its right-hand sides are declarations
 * being read by the generator, not uses to check.
 */
function sources(): string[] {
  const found: string[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== 'node_modules') walk(path);
      } else if (/\.(tsx?|css)$/.test(entry)) {
        found.push(path);
      }
    }
  };
  walk(join(ROOT, 'src'));
  walk(join(ROOT, 'design-system'));
  return found.filter((path) => !path.includes(join('design-system', 'tokens')));
}

/**
 * The names a file reaches for without a fallback.
 *
 * A name is only counted when the `var()` closes straight after it: `var(--x)` is a use to
 * check and `var(--x, 4px)` is a default the author chose. Block comments come out first --
 * this file's own prose, and `components.css`'s, both name `var(--token)` while declaring
 * nothing.
 */
function usesIn(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...code.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined);
}

/**
 * Files that write `var(--name)` into a string as test data rather than as a style.
 *
 * Both are tests of readers -- one of `tokensIn`, one of the reduced-motion helper -- and the
 * names in them are deliberately made up. Anything added here needs to be a file whose `var()`
 * never reaches a browser.
 */
const NOT_STYLES = [
  'src/test/design-system-tokens.node.test.ts',
  'src/test/token-existence.node.test.ts',
];

describe('every token a component reaches for', () => {
  it('is one the CSS declares', () => {
    const declared = new Set(declaredTokens());
    const missing: string[] = [];
    for (const path of sources()) {
      const name = relative(ROOT, path);
      if (NOT_STYLES.includes(name)) continue;
      for (const used of usesIn(readFileSync(path, 'utf8'))) {
        if (!declared.has(used)) missing.push(`${name}: ${used}`);
      }
    }
    // Listed rather than counted: an undefined token is a line a browser silently threw away,
    // and the only useful failure message is which line and which name.
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it('would notice a name nothing declares', () => {
    // The assertion above passes just as happily against an empty file list or a reader that
    // matches nothing, and both of those look exactly like success.
    expect(usesIn('color: var(--nope); padding: var(--space-4)')).toEqual(['--nope', '--space-4']);
    expect(usesIn('padding: var(--maybe, 12px)')).toEqual([]);
    expect(usesIn('/* prose about var(--imaginary) */ color: var(--text)')).toEqual(['--text']);
    expect(sources().length).toBeGreaterThan(50);
  });
});
