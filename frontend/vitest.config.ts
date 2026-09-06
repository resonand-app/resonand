/**
 * Vitest (`INF-3c`).
 *
 * Separate from vite.config.ts rather than a `test` key inside it, for the reason the backend
 * keeps pytest's settings out of the build: the thing that produces the bundle and the thing
 * that checks the code are answerable to different people, and merging them means a change to
 * one is a diff in the other. It reads the build config through `mergeConfig`, so the `@/` alias
 * and the React plugin are described exactly once.
 */

import { fileURLToPath } from 'node:url';

import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // jsdom rather than happy-dom: the player, the follow-and-release scroll and the
      // anchored overlays are all measured behaviour, and the more faithful DOM is worth the
      // slower start.
      environment: 'jsdom',
      // `describe`, `it` and `expect` are imported, not ambient. A test file that says where
      // its own vocabulary comes from is one the type checker and ESLint can both read without
      // a second global namespace to be told about.
      globals: false,
      setupFiles: [fileURLToPath(new URL('./src/test/setup.ts', import.meta.url))],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,

      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.{test,spec}.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
        ],
        // A floor, not a target. It is deliberately below where the code sits so that it
        // fails on a real regression rather than on the ordinary shape of a commit -- a
        // threshold that goes red every other push is a threshold everybody learns to raise.
        // The views raise it; `INT-6` is the check that actually matters.
        thresholds: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  }),
);
