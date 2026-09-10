/**
 * The document itself is styled, and in the right order (`UI-35a`).
 *
 * This layer went missing once and cost two visible bugs at the same time: an 8px white frame
 * around the whole interface, and a frame that scrolled 40px on a view that fits the screen. One
 * cause each. The browser's default `body` margin was never zeroed, so the interface sat inside a
 * band of canvas that no token described and that the theme therefore could not colour. And
 * `box-sizing` was never set to `border-box`, so `Shell` -- which is `100dvh` tall with
 * `--panel-gap` of padding, and which must never scroll -- had a border box 24px taller than the
 * screen.
 *
 * **What this test can and cannot do.** It cannot see either bug: jsdom has no layout, so
 * `Shell`'s height is a string to it and the white band never gets painted. Only a browser
 * catches those, and one did. What jsdom can do is hold the fix in place, and the fix is entirely
 * a question of which declarations exist and in what order -- which is exactly what got lost.
 * Asserting the rule is not asserting the pixel, and the difference is the reason this file says
 * so rather than pretending otherwise.
 *
 * The order is load-bearing twice over: `base.css` reads `--bg` and `--text`, so it has to follow
 * the tokens, and a component's own painting has to beat the page's, so it has to precede
 * `components.css`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** A stylesheet with its comments removed, so a rule quoted in prose is never mistaken for one. */
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

const BASE = withoutComments(read('design-system/base.css'));
const STYLES = withoutComments(read('design-system/styles.css'));

/** Where an `@import` of `name` appears in `styles.css`, or -1. */
const importIndex = (name: string) => STYLES.indexOf(`"${name}"`);

describe('the base layer', () => {
  it('is imported by the stylesheet', () => {
    expect(importIndex('base.css')).toBeGreaterThan(-1);
  });

  it('comes after the tokens it reads and before the components that override it', () => {
    const base = importIndex('base.css');
    expect(base).toBeGreaterThan(importIndex('tokens/semantic.css'));
    expect(base).toBeLessThan(importIndex('components.css'));
  });

  it('makes every box a border-box', () => {
    // `Shell` states a height and a padding on one element and means the height. Under the
    // browser's `content-box` default it means the height plus the padding, which is the frame
    // overflowing the screen by exactly `--panel-gap` at each end.
    expect(BASE).toMatch(/\*[\s\S]*?\{[^}]*box-sizing:\s*border-box/);
  });

  it('removes the user agent margin from the page', () => {
    expect(BASE).toMatch(/body\s*\{[^}]*margin:\s*0/);
  });

  it('paints the page from a token rather than leaving the canvas to the browser', () => {
    // Without this the band outside the frame is whatever `color-scheme` decides, which is white
    // in a light-preferring browser no matter which theme the interface is drawing.
    expect(BASE).toMatch(/body\s*\{[^}]*background:\s*var\(--bg\)/);
  });

  it('zeroes the margin on every heading level and on paragraphs', () => {
    // Spacing is the container's `gap`; text that brings its own margin adds to it rather than
    // filling it. Every level, because the one that gets missed is the one nobody wrote a rule
    // for -- `h5` and `h6` are unused today and are exactly what this is for.
    const rule = /(?:^|\})\s*((?:h[1-6]|p)\s*(?:,\s*(?:h[1-6]|p)\s*)*)\{[^}]*margin:\s*0/m;
    const selectors = rule.exec(BASE)?.[1] ?? '';
    for (const tag of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p']) {
      expect(selectors.split(',').map((part) => part.trim())).toContain(tag);
    }
  });
});
