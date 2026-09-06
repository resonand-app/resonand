/**
 * Every pair of tokens the interface puts together clears AA, in both themes (`UI-33c`).
 *
 * The point is not that the palette is correct today -- it is that **a token change which breaks
 * contrast fails here rather than shipping**. Colour is chosen once and read for years, and the
 * failure mode is silent: nothing throws, nothing looks broken to the person who made the change,
 * and somebody who cannot tell the green from the red simply stops being able to use a screen.
 *
 * It resolves each semantic name through its `var()` chain to a hex, which is what makes it an
 * audit of the tokens rather than of a screenshot. Three things it found when it was written, all
 * fixed in the same commit:
 *
 * - **The four transcription-state colours failed AA in light mode**, 2.35 to 3.06, because they
 *   had no light ramp at all.
 * - **The two badge fills never flipped**, so a light interface drew a near-black chip on a white
 *   card.
 * - **The library ramp's light half was unreachable.** It was declared and nothing aliased it, so
 *   an amber library sat at 1.89 against a white card -- under the 3:1 a 9px dot needs to be seen.
 *
 * Thresholds are WCAG 2.2: 4.5 for text, 3.0 for a graphical object you have to see to understand
 * the content, which is what a waveform and a library dot are.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TOKENS = resolve(dirname(fileURLToPath(import.meta.url)), '../../design-system/tokens');

const AA_TEXT = 4.5;
const AA_GRAPHIC = 3;

type Theme = 'dark' | 'light';

function read(file: string): string {
  return readFileSync(resolve(TOKENS, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

function declarations(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [
      name ?? '',
      (value ?? '').trim(),
    ]),
  );
}

/** The raw ramps, plus the semantic layer for one theme laid over them. */
function palette(theme: Theme): Map<string, string> {
  const ramps = declarations(read('colors.css') + read('shape.css'));
  const semantic = read('semantic.css');
  const block =
    theme === 'dark'
      ? /:root \{([\s\S]*?)\n\}/.exec(semantic)
      : /\n\[data-theme="light"\] \{([\s\S]*?)\n\}/.exec(semantic);
  for (const [name, value] of declarations(block?.[1] ?? '')) ramps.set(name, value);
  return ramps;
}

/** Follow `var()` until a literal falls out. */
function hexOf(name: string, colours: Map<string, string>): string {
  let value = colours.get(name);
  const seen = new Set<string>();
  while (value?.startsWith('var(') === true) {
    const next = /var\((--[a-z0-9-]+)\)/.exec(value)?.[1];
    if (next === undefined || seen.has(next)) break;
    seen.add(next);
    value = colours.get(next);
  }
  expect(value, `${name} does not resolve to a colour`).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  return value ?? '';
}

function luminance(hex: string): number {
  // `#abc` doubles to `#aabbcc`. A replace rather than spreading the string: spreading one walks
  // code points, and this is only ever six hex digits.
  const full = hex.replace(/^#(\w)(\w)(\w)$/, '#$1$1$2$2$3$3').slice(1, 7);
  const channels = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}

/** Every pair the interface actually draws, and what each one has to clear. */
const TEXT_PAIRS: [string, string][] = [
  ['--text', '--bg'],
  ['--text', '--surface'],
  ['--text', '--surface-2'],
  ['--text-2', '--bg'],
  ['--text-2', '--surface'],
  ['--text-2', '--surface-2'],
  ['--text-3', '--bg'],
  ['--text-3', '--surface'],
  ['--text-3', '--surface-2'],
  ['--accent', '--bg'],
  ['--accent', '--surface'],
  ['--accent-on', '--accent'],
  ['--accent-on-soft', '--accent-soft'],
  ['--state-none', '--surface-2'],
  ['--state-running', '--surface-2'],
  ['--state-done', '--state-done-bg'],
  ['--state-failed', '--state-failed-bg'],
  ['--state-failed-fg', '--state-failed-bg'],
];

const GRAPHIC_PAIRS: [string, string][] = [
  ['--wave', '--surface'],
  ['--wave', '--bg'],
  ['--wave-dim', '--bg'],
  ...(['amber', 'clay', 'slate', 'moss', 'stone', 'plum', 'teal'] as const).flatMap(
    (name): [string, string][] => [
      [`--library-${name}`, '--surface'],
      [`--library-${name}`, '--bg'],
    ],
  ),
];

describe.each(['dark', 'light'] as const)('contrast in %s', (theme) => {
  const colours = palette(theme);

  it.each(TEXT_PAIRS)('%s on %s clears AA for text', (fg, bg) => {
    expect(contrast(hexOf(fg, colours), hexOf(bg, colours))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(GRAPHIC_PAIRS)('%s on %s clears AA for a graphic', (fg, bg) => {
    expect(contrast(hexOf(fg, colours), hexOf(bg, colours))).toBeGreaterThanOrEqual(AA_GRAPHIC);
  });

  it('keeps --text-3 the quietest text and still readable everywhere', () => {
    // The README says "never place `--text-3` on anything lighter than `--bg`", which is the
    // dark-mode phrasing of a rule that has to hold in both: in light mode the page is
    // `--paper-200` and the surfaces sitting on it are *white*, so the surfaces are the lighter
    // thing and the sentence inverts. What does not invert is the invariant underneath it --
    // `--text-3` is the quietest of the three, and the quietest still has to clear AA on every
    // surface it can land on, which the pairs above assert one by one.
    const worst = (name: string) =>
      Math.min(
        ...['--bg', '--surface', '--surface-2'].map((surface) =>
          contrast(hexOf(name, colours), hexOf(surface, colours)),
        ),
      );
    expect(worst('--text-3')).toBeLessThanOrEqual(worst('--text-2'));
    expect(worst('--text-2')).toBeLessThanOrEqual(worst('--text'));
    expect(worst('--text-3')).toBeGreaterThanOrEqual(AA_TEXT);
  });
});

describe('the audit itself', () => {
  it('resolves rather than guessing', () => {
    // If `hexOf` ever silently returned a default, every assertion above would pass against it.
    const dark = palette('dark');
    const light = palette('light');
    expect(hexOf('--bg', dark)).not.toBe(hexOf('--bg', light));
    expect(hexOf('--state-done-bg', dark)).not.toBe(hexOf('--state-done-bg', light));
    expect(hexOf('--library-amber', dark)).not.toBe(hexOf('--library-amber', light));
  });

  it('computes a ratio the way WCAG does', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrast('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
