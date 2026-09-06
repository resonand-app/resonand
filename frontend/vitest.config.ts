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
      // Both trees. `design-system/` is the application's component source (`DEC-21`), so a
      // component's test sits beside the component rather than in a parallel folder under
      // `src/` that has to be kept in step with it by hand.
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'design-system/**/*.{test,spec}.{ts,tsx}'],
      css: false,

      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        // `src/**` only, and `design-system/**` deliberately not yet. `UI-1d` through `UI-1h`
        // are transcription with a type checker watching -- no visual change, no behaviour
        // change -- and holding twenty-one components to a coverage floor as they are renamed
        // would turn five mechanical tasks into twenty-one test-writing ones. The system joins
        // this list at `UI-1k`, by which point `UI-1i`'s tokens guard, `UI-32b`'s focus walk and
        // the specimen route give it real tests to be measured against.
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
