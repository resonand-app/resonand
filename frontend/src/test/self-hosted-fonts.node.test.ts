/**
 * The fonts are shipped, not fetched (`UI-1a`).
 *
 * `UI-1a`'s criterion is that the interface renders with the network blocked, and a criterion
 * nobody can run is a criterion that quietly stops being true. The regression it guards against
 * is small and specific: somebody adds a face by pasting the `@import` line a font service hands
 * out, and nothing looks wrong until the deployment with no route to the internet draws itself
 * in the fallback stack.
 *
 * It reads the stylesheet off disk rather than through Vite, because that is one of the two ways
 * the file is read for real -- the seventeen cards in `guidelines/` `<link>` it with no bundler
 * in the way -- and because a `url()` that Vite would rewrite is not the thing under test.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const TOKENS = resolve(dirname(fileURLToPath(import.meta.url)), '../../design-system/tokens');

const FONTS_CSS = resolve(TOKENS, 'fonts.css');

/**
 * The stylesheet with its comments taken out.
 *
 * The comments are where this file explains which request it closed and what used to make it,
 * so they name the very things below assert are absent. Only the rules are under test.
 */
function rulesOf(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Every `url(...)` in a stylesheet, quoted or not. */
function urlsIn(css: string): string[] {
  return [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((match) => match[1] ?? '');
}

describe('the design system asks nothing of the network', () => {
  const css = rulesOf(readFileSync(FONTS_CSS, 'utf8'));

  it('declares no font from a remote origin', () => {
    expect(css).not.toMatch(/@import/);
    expect(urlsIn(css).filter((url) => /^(https?:)?\/\//.test(url))).toEqual([]);
  });

  it('points every face at a file that is actually here', () => {
    const urls = urlsIn(css);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(existsSync(resolve(TOKENS, url)), `${url} is declared but not shipped`).toBe(true);
    }
  });

  it('ships both Geist faces, which were loaded from Google Fonts until UI-1a', () => {
    for (const family of ['Geist', 'Geist Mono']) {
      expect(css).toMatch(new RegExp(`font-family:\\s*"${family}"`));
    }
  });

  it('ships no face whose licence is not beside it', () => {
    // `INF-11` is what this is for. Chillax sat here for months, declared and working, and was
    // the one face nobody was allowed to redistribute -- a fact no check could see, because the
    // thing that was wrong was the absence of a file rather than the presence of one. Adding a
    // face now means naming its licence here, and the naming is the review.
    const licences: Record<string, string> = {
      Geist: 'Geist-OFL.txt',
      GeistMono: 'Geist-OFL.txt',
      Gabarito: 'Gabarito-OFL.txt',
    };
    const dir = resolve(TOKENS, '../assets/fonts');
    const faces = readdirSync(dir).filter((name) => name.endsWith('.woff2'));
    expect(faces.length).toBeGreaterThan(0);
    for (const face of faces) {
      const family = face.split('-')[0] ?? '';
      const licence = licences[family];
      expect(licence, `${face} ships with no licence named for it`).toBeDefined();
      if (licence !== undefined) {
        expect(existsSync(resolve(dir, licence)), `${licence} is named but not here`).toBe(true);
      }
    }
  });

  it('ships the display face, and the licence that lets it be shipped', () => {
    // `INF-11` is the whole reason this assertion exists: a face can be in the tree, declared and
    // working, and still be one nobody is allowed to redistribute. The licence beside it is the
    // part that is checkable, so it is checked.
    expect(css).toMatch(/font-family:\s*"Gabarito"/);
    expect(existsSync(resolve(TOKENS, '../assets/fonts/Gabarito-OFL.txt'))).toBe(true);
  });
});
