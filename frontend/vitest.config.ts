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
      // Five seconds is vitest's default and it is not enough here, because this machine runs
      // several agents at once: each has its own worktree and its own copy of this suite, and a
      // second one testing turns a one-second test into a six-second one. The failures that
      // caused were scattered, different every run, and never in the code being committed --
      // which is the worst kind, because the honest reading of a red gate is that you broke
      // something. Capping workers was measured and is the wrong lever: it fixes contention a
      // run inflicts on itself, and the contention here comes from the other worktrees, so all
      // it does is stretch the run and widen the window it is exposed for -- three times slower
      // and still red. Twenty seconds costs nothing on a quiet machine and only delays the
      // report of a test that really has hung.
      testTimeout: 20_000,
      hookTimeout: 30_000,
      // `describe`, `it` and `expect` are imported, not ambient. A test file that says where
      // its own vocabulary comes from is one the type checker and ESLint can both read without
      // a second global namespace to be told about.
      globals: false,
      setupFiles: [fileURLToPath(new URL('./src/test/support/setup.ts', import.meta.url))],
      // Both trees. `design-system/` is the application's component source (`DEC-21`), so a
      // component's test sits with the component rather than in a parallel folder under `src/`
      // that has to be kept in step with it by hand.
      //
      // Under `src/` "with" means a `tests/` folder inside the folder it covers, so that what a
      // feature lists is the feature and not twice the feature. It is still local -- it moves,
      // renames and dies with what it tests, which is the whole objection to a parallel tree --
      // and this glob needs no knowledge of it, because a test is known by its name and not by
      // where it sits. The design system keeps its tests flat: there a component is a set of
      // three files, and `.prompt.md` is the one that would be left behind.
      include: ['src/**/*.{test,spec}.{ts,tsx}', 'design-system/**/*.{test,spec}.{ts,tsx}'],
      // No stylesheet is processed or injected -- a component test asserts what a component
      // renders, not what a browser would paint it -- with one exception, added by `UI-32a`:
      // `?raw`. `interaction-layer.test.tsx` reads `components.css` as text and holds every
      // component to what the stylesheet claims to own, and a bare `css: false` answers a `?raw`
      // request with an empty string, which is a check that passes because it read nothing.
      css: { include: [/\?raw/] },

      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        // Both trees, as of `UI-1k`. The conversion tasks were let off this floor on purpose --
        // holding twenty-one components to it while they were being renamed would have turned
        // five mechanical tasks into twenty-one test-writing ones -- and the specimen page is
        // what pays that back, because it imports and renders every one of them at once.
        include: ['src/**/*.{ts,tsx}', 'design-system/**/*.{ts,tsx}'],
        exclude: [
          'src/**/*.{test,spec}.{ts,tsx}',
          'src/test/**',
          'src/main.tsx',
          'src/vite-env.d.ts',
          // The specimen page and its sample data (`UI-1k`). Development only -- the production
          // build drops both -- and its own smoke test already asserts the thing it is for, which
          // is that every component mounts. Measuring how many of its inline click handlers a
          // test happened to fire would move this number without meaning anything.
          'src/dev/**',
          // The generated API surface (`UI-3a`). It is types and nothing else, so it compiles to
          // no statements at all -- and what has to be true of it is not a percentage but that it
          // is reproducible, which `api-schema.node.test.ts` asserts directly.
          'src/api/contract/**',
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
