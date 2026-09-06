/**
 * ESLint (`INF-3b`).
 *
 * It holds the frontend to the standard the backend already holds itself to: the same rules run
 * in the editor, in `pre-commit` and in CI, and they fail identically in all three (`INF-3d`).
 *
 * Three things it is deliberately not. It is not a style guide -- Prettier owns formatting and
 * `eslint-config-prettier` turns off every rule that would argue with it, which is why that entry
 * is last. It is not a substitute for the type checker -- `npm run typecheck` is a separate
 * script and a separate CI step, because `tsc` reports things ESLint cannot and the two failing
 * for the same reason would hide that. And it is not yet the tokens-only guard: that is `UI-1i`,
 * which ports the three rules the design system's own adherence config encodes so a hex colour
 * fails while it is being typed rather than only in CI.
 *
 * **ESLint 9 and not 10, because of `jsx-a11y`.** `eslint-plugin-jsx-a11y@6.10.2` declares
 * `eslint: ^3 || ... || ^9` and there is no 10-compatible release. Accessibility is a criterion
 * this plan is checked against in three places -- `UI-23a`'s axe audit on every view, `UI-32b`'s
 * focus treatment and `UI-24b`'s 44px floor -- so the plugin wins and the major waits. The same
 * shape of constraint as `DEC-20`'s TypeScript ceiling, and recorded here for the same reason:
 * somebody will otherwise "fix" the version and find out why in CI.
 */

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'dist/**',
    'coverage/**',
    'node_modules/**',
    // The design system is `.jsx` until Phase C converts it in place (`DEC-21`). Linting it
    // against rules written for the strict `.tsx` it is about to become would report the
    // conversion as hundreds of errors before anybody had started it. `UI-1d`-`UI-1h` delete
    // this line one folder at a time.
    'design-system/**',
  ]),

  // --- Everything ---------------------------------------------------------
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // `projectService` rather than a `project` array: the tsconfig is a solution file with
        // two references, and keeping a second list of them here is a list that goes stale.
        // Every file linted belongs to one of the two, this one included -- tsconfig.node.json
        // names it, which is what gives the rules below real types to work from rather than
        // `any`.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // A `Promise` nobody waits for is how an upload silently does not happen. Both halves are
      // on: the un-awaited call and the handler that returns one where `void` was expected.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // `_` prefixed is the deliberate discard; anything else unused is a leftover.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      // Import order, so a diff shows a change and not a reshuffle. Prettier has no opinion
      // about it, which is why it has to be a lint rule.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Reach up with the `@/` alias rather than with `../`.',
            },
          ],
        },
      ],
      // `console.log` left in a view ships to everybody who opens it. Warnings and errors are
      // allowed, because an error worth swallowing is worth printing.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // --- React --------------------------------------------------------------
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // `configs.flat[...]`, not `configs[...]`: the plugin still ships the eslintrc-shaped
      // pair at the top level, and flat config rejects it with an unhelpful message.
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // --- The config files themselves ----------------------------------------
  {
    files: ['*.config.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Last, always: it turns rules off and turning them back on afterwards would be an accident.
  prettier,
);
