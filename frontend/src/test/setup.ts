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

afterEach(() => {
  cleanup();
});
