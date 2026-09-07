/**
 * What every test gets (`INF-3c`).
 *
 * `jest-dom` for the matchers that say what a test means -- `toBeVisible()` rather than a
 * comparison against a computed style -- and a cleanup after each test, because Testing Library
 * mounts into a real document and a component left mounted is the next test's flake.
 */

import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

import { createI18n } from '@/i18n';

// The real English bundle, in English, for every test (`UI-22a`). A component calls `t()` and a
// test asserts on the sentence a person would read -- which is the assertion worth making, and
// is only possible because the base language is the one the strings are written in. A test that
// needs another language switches this instance; nothing needs a provider.
createI18n('en');

afterEach(() => {
  cleanup();
});
