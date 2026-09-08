/**
 * 🧪 No transcription can be asked for without saying where the audio goes (`UI-25b`, §3.4).
 *
 * **This test is principle 2's implementation.** *Nothing leaves the instance without saying so
 * first* is otherwise a sentence in a document: a component can render the disclosure today and a
 * new surface can request a transcription tomorrow without one, and nothing about the running
 * software would look wrong. Every individual placement is also tested where it is drawn
 * (`TranscriptionState`, `TranscriptVersions`), but those tests pass on the surfaces that exist
 * -- and the failure this one exists to catch is the surface somebody adds later.
 *
 * So it is a check on the shape of the repository rather than on a rendered screen: **any file
 * that asks for a transcription must also draw `EgressNotice`.** There are two ways to ask, and
 * both are covered -- `POST /audio/{uuid}/transcribe`, which is the call to action, the retry and
 * re-transcribing; and the `transcribe` flag on an upload, which is `UI-18c`. The second has no
 * surface yet, and when it grows one this test is what will be waiting for it.
 *
 * The exemption list is the interesting half. A module may ask without drawing the notice only if
 * it is not a surface at all -- the typed call, or the hook that wraps it -- and each entry says
 * which. Both directions are asserted: an unlisted asker fails, and **a listed file that no
 * longer asks fails as well**, so the list cannot quietly become the place where the rule goes to
 * die.
 */

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * How a file asks for a transcription.
 *
 * The endpoint by its published path, the hook that calls it, and the flag that asks for one at
 * upload time. Named by what they are rather than by a word: `transcribe` appears in prose, in a
 * translation key and in a state name, and a rule that matched the word would be a rule turned
 * off within a week.
 */
const ASKS = [
  /'\/api\/audio\/\{audio_uuid\}\/transcribe'/,
  /\buseTranscribe\b/,
  /transcribe\.mutate\(/,
  /append\(\s*'transcribe'/,
  /\btranscribe:\s*(?:true|transcribe)\b/,
];

/**
 * Files that ask without drawing the notice, and why each is not a surface.
 *
 * The rule is the same as `token-adherence.mjs`'s exemptions: an entry is a promise that this
 * file cannot be the one that shows somebody a control, so it needs a reason a reviewer can
 * check. It only ever shrinks.
 */
const NOT_A_SURFACE: { file: string; why: string }[] = [
  {
    file: 'features/recording/transcription.ts',
    why: 'The typed call and the hook around it. It renders nothing and has no control to put a notice beside.',
  },
];

/** Every source file the application ships, tests aside. */
function sources(): { path: string; source: string }[] {
  return globSync('**/*.{ts,tsx}', { cwd: SOURCE })
    .filter((path) => !path.includes('.test.') && !path.startsWith('test'))
    .sort()
    .map((path) => ({
      path: path.split('\\').join('/'),
      source: readFileSync(resolve(SOURCE, path), 'utf8'),
    }));
}

/** Whether a file asks the instance to transcribe something. */
function asks(source: string): boolean {
  return ASKS.some((pattern) => pattern.test(source));
}

/** Whether a file draws the disclosure. */
function discloses(source: string): boolean {
  return source.includes('EgressNotice');
}

describe('every path to a transcription', () => {
  it('says where the audio goes, or is not a surface and says why', () => {
    const exempt = new Set(NOT_A_SURFACE.map((entry) => entry.file));
    const silent = sources()
      .filter(({ path, source }) => asks(source) && !discloses(source) && !exempt.has(path))
      .map(({ path }) => path);

    // If this fails, a screen can send somebody's recording to a provider without telling them
    // first. Either draw `EgressNotice` beside the control, or hand the request to a surface
    // that does -- do not add the file to the list above unless it renders nothing at all.
    expect(silent).toEqual([]);
  });

  it('is asked for from somewhere, so the rule is not vacuously true', () => {
    // A rule that matches nothing passes for ever. This is the half that fails when the patterns
    // above stop describing how a transcription is requested -- a renamed hook, a moved endpoint.
    const asking = sources().filter(({ source }) => asks(source));
    expect(asking.length).toBeGreaterThan(1);
  });

  it('has no exemption left over for a file that no longer asks', () => {
    const files = new Map(sources().map(({ path, source }) => [path, source]));
    for (const { file, why } of NOT_A_SURFACE) {
      const source = files.get(file);
      // A stale exemption is a hole nobody remembers opening. This is what emptied the token
      // guard's own list and is what will empty this one.
      expect(source, `${file} is exempt and no longer exists`).toBeDefined();
      expect(asks(source ?? ''), `${file} is exempt and no longer asks`).toBe(true);
      expect(why.length).toBeGreaterThan(20);
    }
  });
});
