/**
 * `isApplePlatform` is what `SearchField` asks before printing ⌘ or Ctrl (`theme/platform.ts`).
 *
 * Fed strings rather than a stubbed `navigator`: the function takes the platform string as an
 * overridable default for exactly this reason, and a test that supplies it directly is a test
 * that cannot be broken by whichever OS happens to run the suite.
 */

import { describe, expect, it } from 'vitest';

import { isApplePlatform } from './platform';

describe('isApplePlatform', () => {
  it.each([
    ['MacIntel', true],
    ['iPhone', true],
    ['iPad', true],
    ['Win32', false],
    ['Linux x86_64', false],
    ['', false],
  ])('reads %s as Apple: %s', (platform, expected) => {
    expect(isApplePlatform(platform)).toBe(expected);
  });
});
