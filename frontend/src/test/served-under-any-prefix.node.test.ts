/**
 * The bundle names no prefix, and the shell names it once (`OPS-4`, `UI-39`).
 *
 * One image serves `sonarium.example.org` and `example.org/sonarium`, so the prefix is a fact of
 * the deployment and cannot be a build input. The arrangement that makes that true has four
 * parts, in three files, and none of them fails visibly on its own: a relative Vite base, a
 * `<base href>` the API rewrites as it serves the shell, a manifest whose URLs are relative to
 * itself, and a deployment prefix on every URL the client does not build.
 *
 * Break any one and the interface still works perfectly at the domain root, which is where it is
 * developed and where every other test runs it. The subpath is where it fails, and it fails as a
 * blank page in somebody else's deployment -- so it is asserted here rather than found there.
 *
 * `UI-39` rides with it: an installed instance is dark before the bundle loads, or it flashes
 * white on every launch.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** A token's value, followed through its `var()` chain to the literal at the end of it. */
function tokenValue(name: string, theme: 'dark' | 'light'): string {
  const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
  const declarations = (block: string) =>
    [...block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(
      ([, key, value]) => [key ?? '', (value ?? '').trim()] as const,
    );

  const semantic = strip(read('design-system/tokens/semantic.css'));
  const block =
    theme === 'dark'
      ? /:root \{([\s\S]*?)\n\}/.exec(semantic)
      : /\n\[data-theme="light"\] \{([\s\S]*?)\n\}/.exec(semantic);
  const declared = new Map([
    ...declarations(strip(read('design-system/tokens/colors.css'))),
    ...declarations(block?.[1] ?? ''),
  ]);

  let value = declared.get(name);
  while (value?.startsWith('var(') === true) {
    value = declared.get(/var\((--[a-z0-9-]+)\)/.exec(value)?.[1] ?? '');
  }
  return (value ?? '').toUpperCase();
}

/** Every file under `src/` the application ships, with its comments stripped. */
function applicationSource(): { path: string; code: string }[] {
  const found: { path: string; code: string }[] = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(resolve(ROOT, directory), { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'tests' && entry.name !== 'test' && entry.name !== 'contract') {
          walk(path);
        }
      } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
        found.push({
          path,
          code: read(path)
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/^\s*\/\/.*$/gm, ''),
        });
      }
    }
  };
  walk('src');
  return found;
}

describe('an instance served under a prefix', () => {
  it('builds a bundle that names no prefix at all', () => {
    // Relative, so every emitted URL resolves against the document's base rather than against
    // the domain root. This is the half that lets the other half exist.
    expect(read('vite.config.ts')).toMatch(/base:\s*'\.\/'/);
  });

  it('declares the deployment root once, before anything that names a URL', () => {
    const html = read('index.html');
    const bases = [...html.matchAll(/<base\b/g)];
    expect(bases).toHaveLength(1);
    // `/` is the value the build ships and the value a subdomain keeps; the API rewrites it in
    // the shell it serves. A base element after the first URL is ignored for that URL.
    expect(html).toContain('<base href="/" />');
    expect(html.indexOf('<base')).toBeLessThan(html.indexOf('<link'));
    expect(html.indexOf('<base')).toBeLessThan(html.indexOf('src='));
  });

  it('hands the client every URL it does not build itself', () => {
    // A path in quotes is given to `client.ts`, which prefixes it. A path in a template literal
    // is a URL somebody assembled -- the player's stream, the download link, the upload -- and
    // those are the three that silently 404 one directory below the root.
    for (const { path, code } of applicationSource()) {
      if (path.endsWith(join('api', 'client.ts'))) continue;
      for (const [literal] of code.matchAll(/`[^`]*`/g)) {
        if (!literal.includes('/api/')) continue;
        expect(literal, `${path} builds an API URL with no deployment prefix`).toContain(
          '${DEPLOYMENT_BASE}',
        );
      }
    }
  });
});

describe('the web-app manifest', () => {
  const manifest = JSON.parse(read('public/site.webmanifest')) as {
    start_url: string;
    scope: string;
    icons: { src: string }[];
    theme_color: string;
    background_color: string;
    display: string;
  };

  it('starts and scopes itself where it is served, not at the domain root', () => {
    // Resolved against the manifest's own URL, so `.` is `/sonarium/` on a subpath and `/` on a
    // subdomain. Absent, `start_url` is whatever page somebody happened to install from -- which
    // for this interface is usually one recording.
    expect(manifest.start_url).toBe('.');
    expect(manifest.scope).toBe('.');
    for (const icon of manifest.icons) expect(icon.src.startsWith('./')).toBe(true);
  });

  it('is dark, because the product is', () => {
    const surface = tokenValue('--surface', 'dark');
    expect(surface).toBe('#12151C');
    // `background_color` is the splash an installed instance paints before the bundle runs, and
    // `theme_color` the chrome around it. White here is a flash on every single launch.
    expect(manifest.background_color.toUpperCase()).toBe(surface);
    expect(manifest.theme_color.toUpperCase()).toBe(surface);
  });

  it('agrees with the chrome colour the shell declares', () => {
    const html = read('index.html');
    expect(html).toContain(
      `<meta name="theme-color" content="${tokenValue('--surface', 'dark')}" media="(prefers-color-scheme: dark)" />`,
    );
    expect(html).toContain(
      `<meta name="theme-color" content="${tokenValue('--surface', 'light')}" media="(prefers-color-scheme: light)" />`,
    );
  });
});
