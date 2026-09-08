/**
 * 🧪 Nothing in the upload surface implies an upload can be resumed (`UI-18f`, §3.3).
 *
 * `POST /libraries/{uuid}/audio` is a single request: an interruption restarts it from the first
 * byte, and there is no endpoint that would take up where it left off. So the design promises
 * nothing -- no pause control, no "resuming", no "paused" state -- and this is the check that
 * keeps that true after somebody adds a control that seems obviously missing.
 *
 * It is a check on the shape of the repository rather than on a screen, for the same reason the
 * egress disclosure's is: the failure worth catching is the surface somebody adds next year. A
 * pause button drawn in the tray would look entirely reasonable in review, and the thing that is
 * wrong with it is a property of the API rather than of the component.
 *
 * The words are checked in two places: the upload feature's own code, and the English bundle,
 * which is where the label of any such control would have to be written. `Progress` has no
 * indeterminate mode for the same family of reasons, and its own test holds that.
 */

import { globSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * What a control that promised resumption would be called.
 *
 * Word-bounded, so `unpause` and `presume` do not match, and deliberately not including "stop" or
 * "cancel": stopping an upload is honest -- it is abandoning it -- and taking it up again is not.
 */
const PROMISES = /\b(pause[ds]?|pausing|resume[ds]?|resuming|resumable)\b/i;

/** Every file in the upload feature, and the strings any of them could render. */
function surfaces(): { path: string; source: string }[] {
  return globSync('features/upload/**/*.{ts,tsx}', { cwd: SOURCE })
    .concat('i18n/en/upload.json')
    .filter((path) => !path.includes('.test.'))
    .sort()
    .map((path) => ({
      path: path.split('\\').join('/'),
      source: readFileSync(resolve(SOURCE, path), 'utf8'),
    }));
}

describe('an upload', () => {
  it('is never offered a pause or a resumption anywhere in the interface', () => {
    const promising = surfaces()
      .filter(({ source }) => PROMISES.test(strippedOfComments(source)))
      .map(({ path }) => path);

    // If this fails, the interface is offering something `POST /libraries/{uuid}/audio` cannot
    // do. An upload that is interrupted starts again from the first byte; say "again", not
    // "resume", and do not draw a control that suggests the transfer is being held.
    expect(promising).toEqual([]);
  });

  it('has an upload feature to check, so the rule is not vacuously true', () => {
    expect(surfaces().length).toBeGreaterThan(3);
  });
});

/**
 * The code without its prose.
 *
 * The rule is about what the interface offers, and this file's own explanation of why it offers
 * nothing has to be allowed to use the words -- as does the queue's note that a retry is a fresh
 * request rather than a resumption.
 */
function strippedOfComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, ' ').replaceAll(/\/\/[^\n]*/g, ' ');
}
