/**
 * 🧪 The security pass over the finished client (`INT-5`, `UI-3b`, `DEC-14`, §1.9).
 *
 * Three claims, and none of them is a thing a view can be trusted to remember. Each is a property
 * of the whole tree, so each is asserted over the whole tree -- the sources are read as text the
 * way `egress-disclosure.node.test.ts` reads them, and the one runtime assertion is here too
 * rather than in a second file, because splitting a security pass across two places is how half
 * of it stops being run.
 *
 * **No token in a URL that persists.** Authorisation is the session cookie: same-origin, no
 * header, nothing to keep. The one exception is real and is designed for -- `<audio>` cannot send
 * a header, and a browser that refuses cookies on media requests would otherwise play nothing, so
 * `POST /audio/{uuid}/playback-token` mints a token that goes on the element's `src`. That is a
 * subresource and not a navigation, so it never reaches the address bar or history. What must
 * stay true is that it goes nowhere else: not into the router, not into storage, not into a link.
 *
 * **No privileged path.** The client decides nothing about authorisation. It has no credential to
 * hold, sends no `Authorization` header, names no origin but its own, and never asks for
 * `credentials: 'include'` -- which is the flag that would let a cookie travel somewhere the
 * instance is not.
 *
 * **404, not 403, everywhere.** The ACL answers 404 for anything unreadable so that a refusal
 * cannot confirm a resource exists (`DEC-14`). The client keeps that promise or breaks it: a
 * branch on 403, or a sentence saying somebody lacks permission, hands back exactly the
 * information the status code was chosen to withhold. Today there is no such branch and no such
 * sentence, and this is what says so tomorrow.
 */

import { describe, expect, it } from 'vitest';

import { streamUrl } from '@/player/audio';

/**
 * Every source file the interface ships, tests aside.
 *
 * Keys are normalised to repo-relative paths, because Vite writes them relative to this file --
 * `src/test/api/handlers.ts` arrives as `./api/handlers.ts`, which looks like application code
 * and is the mock API. A failure naming the wrong file is a failure somebody dismisses.
 */
const SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob<string>(['../**/*.{ts,tsx}', '../../design-system/**/*.{ts,tsx}'], {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  )
    .map(([key, source]): [string, string] => {
      if (key.startsWith('../../')) return [key.replace('../../', ''), source];
      if (key.startsWith('../')) return [key.replace('../', 'src/'), source];
      return [key.replace('./', 'src/test/'), source];
    })
    .filter(([path]) => !/\.(?:test|spec)\./.test(path) && !path.startsWith('src/test/')),
);

/** The files whose text matches, so a failure names somewhere to go and look. */
function matching(pattern: RegExp): string[] {
  return Object.entries(SOURCES)
    .filter(([, source]) => pattern.test(source))
    .map(([path]) => path)
    .sort();
}

describe('the sources were read at all', () => {
  it('found the tree, so an empty answer means something', () => {
    // Every assertion below is "no file does X". A glob that matched nothing satisfies all of
    // them in silence, which is the one way this file could be pure decoration.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  });
});

describe('no token in a URL that persists', () => {
  it('streams on the cookie, with no query string at all', () => {
    expect(streamUrl('abc')).toBe('/api/audio/abc/stream');
  });

  it('carries a minted token only when one is handed to it', () => {
    // The fallback exists and is allowed to. What matters is that it is the caller's decision
    // rather than the default, so the ordinary path cannot leak one by accident.
    expect(streamUrl('abc', 'tok')).toBe('/api/audio/abc/stream?token=tok');
  });

  it('is built in one place, which is the player', () => {
    // A second file assembling `token=` is a second place a token could reach a link, a redirect
    // or a copyable address -- and it would be reviewed by whoever wrote it and nobody else.
    expect(matching(/[?&]token=/)).toEqual(['src/player/audio.ts']);
  });

  it('never mints one into the address bar or the history', () => {
    const navigating = matching(
      /\b(?:location\s*\.\s*(?:href|assign|replace)|history\.(?:push|replace)State)\b/,
    );
    expect(navigating).toEqual([]);
  });

  it('keeps no credential in storage', () => {
    // Storage is for what a device remembers about itself. The three keys that exist are the
    // theme and two collapse flags; a fourth holding anything a server would accept as proof of
    // identity is the failure this guards.
    const storing = matching(/\b(?:localStorage|sessionStorage)\s*\.\s*setItem\s*\(/);
    expect(storing).toEqual([
      'design-system/theme/theme.ts',
      'src/app/use-sidebar-collapse.ts',
      'src/features/recording/use-panel.ts',
    ]);
  });

  it('writes no cookie of its own', () => {
    // The session cookie is the server's, `HttpOnly`, and the client neither reads nor sets it.
    expect(matching(/document\s*\.\s*cookie\s*=/)).toEqual([]);
  });
});

describe('no privileged path', () => {
  it('sends no Authorization header, because there is nothing to put in one', () => {
    expect(matching(/['"]Authorization['"]|\bBearer\s/)).toEqual([]);
  });

  it('never asks for credentials to travel off this origin', () => {
    // `same-origin` is the whole authorisation model. `include` is the one word that would let
    // the session cookie reach a host the instance does not control.
    expect(matching(/credentials\s*:\s*['"]include['"]/)).toEqual([]);
  });

  it('names no host but the one it was served from', () => {
    // Every path is relative (`DEC-24`), so there is no origin in the bundle to point elsewhere
    // and no build-time hostname to get wrong in a deployment.
    const absolute = matching(/(?:fetch|url|src|href)\s*[(:=]\s*['"`]https?:\/\//i);
    expect(absolute).toEqual([]);
  });
});

describe('404, not 403', () => {
  it('branches on no 403 anywhere', () => {
    // The ACL never sends one. A client that handled it would be a client ready to tell somebody
    // apart from somebody else, which is the distinction `DEC-14` spent a status code to remove.
    const branching = Object.entries(SOURCES)
      .filter(([, source]) => /\b403\b/.test(source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')))
      .map(([path]) => path);
    expect(branching).toEqual([]);
  });

  it('says nothing to a person about permission on a thing they cannot see', () => {
    // The copy half of the same rule. "You do not have permission to view this" tells somebody
    // the recording exists, which is precisely what the 404 was for.
    const bundles = Object.fromEntries(
      Object.entries(
        import.meta.glob<string>('../i18n/en/*.json', {
          query: '?raw',
          import: 'default',
          eager: true,
        }),
      ).map(([path, source]) => [path.split('/').pop() ?? path, source]),
    );
    expect(Object.keys(bundles).length).toBeGreaterThan(5);
    const leaking = Object.entries(bundles)
      .filter(([, source]) =>
        /you do not have permission|not authorised|not authorized|access denied|forbidden/i.test(
          source,
        ),
      )
      .map(([name]) => name);
    expect(leaking).toEqual([]);
  });
});
