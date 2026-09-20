/**
 * An accessible name is copy, and copy lives in `src/i18n/en/` (`UI-22a1`).
 *
 * `UI-22a` put an ESLint rule in front of the attributes a browser reads as a name --
 * `aria-label`, `title`, `placeholder`, `alt` -- and it works on the form it can see: a literal,
 * written directly on a DOM element. It cannot see two things, and the upload tray was both of
 * them at once. The name was passed as a **component prop** (`IconButton`'s `label`), which the
 * rule has no way to know becomes an `aria-label`; and two of the three were the arms of a
 * ternary, which is an expression rather than a literal even to a rule that knew the prop.
 *
 * So three sentences shipped in English in the source, in the one tray that is on screen during
 * the slowest thing the product does. Nobody reviewing caught it, which is the point: what stops
 * the next one has to be a check.
 *
 * **It reads the attribute's whole value, not its first token.** That is the difference between
 * this and the rule it supplements -- a literal anywhere inside the expression is a literal, and
 * a ternary is where they hide.
 *
 * `src/dev/` is exempt and is the only exemption. The specimen page names components rather than
 * addressing a user, it is dropped from the bundle by `import.meta.env.DEV`, and translating a
 * board that says "IconButton" would be translating the word IconButton.
 */

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Props whose value a browser ends up announcing as the element's name. */
const NAMING_PROPS = ['label', 'ariaLabel'];

/** Development-only, and not addressed to anybody using an archive. */
const EXEMPT = 'dev/';

export interface Finding {
  path: string;
  line: number;
  text: string;
}

/**
 * The value of a JSX attribute starting at `from`, brace-balanced.
 *
 * Written rather than parsed with a real parser because the question is one character deep: where
 * this attribute's value ends. A parser would be a dependency and a build step for a check that
 * is looking for quotes.
 */
function valueAt(source: string, from: number): string {
  if (source[from] === '"' || source[from] === "'") {
    const end = source.indexOf(source[from], from + 1);
    return end === -1 ? source.slice(from) : source.slice(from, end + 1);
  }
  if (source[from] !== '{') return '';
  let depth = 0;
  for (let index = from; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(from, index + 1);
    }
  }
  return source.slice(from);
}

/** A quoted run containing a letter: prose, rather than an id, a class or a unit. */
const PROSE = /(["'])[^"'\n]*\p{L}[^"'\n]*\1/u;

/**
 * The value with every translation call taken out of it.
 *
 * Whatever is inside `t(...)` is a key, and a key is a quoted run of letters -- which is exactly
 * what this check looks for. Removing the whole call rather than matching its first argument is
 * what makes `t(plural ? 'a.one' : 'a.other')` read the same as `t('a.one')`: the question is
 * whether prose was written *here*, and anything handed to the translator was not.
 *
 * What survives is the rest of the expression, so `t('a') + ' and then some'` is still caught.
 */
export function withoutTranslationCalls(value: string): string {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const isCall = value.startsWith('t(', index) && !/[\w$.]/.test(value[index - 1] ?? '');
    if (!isCall) {
      out += value[index] ?? '';
      continue;
    }
    let depth = 0;
    let scan = index + 1;
    for (; scan < value.length; scan += 1) {
      if (value[scan] === '(') depth += 1;
      if (value[scan] === ')') {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    index = scan;
  }
  return out;
}

export function untranslatedNames(path: string, source: string): Finding[] {
  const found: Finding[] = [];
  for (const prop of NAMING_PROPS) {
    const attribute = new RegExp(`(?<![\\w-])${prop}=`, 'g');
    for (const match of source.matchAll(attribute)) {
      const start = match.index + match[0].length;
      const value = valueAt(source, start);
      if (value === '' || !PROSE.test(withoutTranslationCalls(value))) continue;
      found.push({
        path,
        line: source.slice(0, match.index).split('\n').length,
        text: `${prop}=${value.split('\n')[0] ?? value}`,
      });
    }
  }
  return found;
}

function sources(): { path: string; source: string }[] {
  return globSync('**/*.tsx', { cwd: SRC })
    .map((path) => path.split('\\').join('/'))
    .filter((path) => !path.includes('.test.') && !path.startsWith(EXEMPT))
    .sort()
    .map((path) => ({ path, source: readFileSync(resolve(SRC, path), 'utf8') }));
}

describe('every accessible name comes from i18n', () => {
  it('finds no English name written into a component', () => {
    const findings = sources().flatMap(({ path, source }) => untranslatedNames(path, source));
    expect(findings.map((one) => `${one.path}:${String(one.line)} ${one.text}`)).toEqual([]);
  });

  it('sees a literal in a ternary, which is the form that shipped', () => {
    const source = `<IconButton label={open ? 'Hide the uploads' : 'Show the uploads'} />`;
    expect(untranslatedNames('x.tsx', source)).toHaveLength(1);
  });

  it('sees a plain literal, and a prop spelled either way', () => {
    expect(untranslatedNames('x.tsx', `<IconButton label="Close the tray" />`)).toHaveLength(1);
    expect(untranslatedNames('x.tsx', `<Switch ariaLabel={'Transcribe'} />`)).toHaveLength(1);
  });

  it('accepts a name that came from a translation, however it was assembled', () => {
    const source = `<IconButton label={open ? t('upload.hide') : t('upload.show')} />`;
    expect(untranslatedNames('x.tsx', source)).toEqual([]);
  });

  it('accepts a key chosen inside the translation call', () => {
    const source = `<Button label={t(all === true ? 'selection.clearAll' : 'selection.all')} />`;
    expect(untranslatedNames('x.tsx', source)).toEqual([]);
  });

  it('still catches prose bolted onto a translation', () => {
    expect(
      untranslatedNames('x.tsx', `<Button label={t('a.b') + ' and then some'} />`),
    ).toHaveLength(1);
  });

  it('does not mistake a longer prop name for this one', () => {
    expect(untranslatedNames('x.tsx', `<Chart xLabel="Time" />`)).toEqual([]);
  });
});
