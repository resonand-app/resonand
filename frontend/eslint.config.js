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
 * for the same reason would hide that. It **is** the fast half of the tokens-only guard (`UI-1i`):
 * a colour or a font stack written inside a component fails while it is being typed, and
 * `token-adherence.node.test.ts` fails on the same thing in CI. Both read one description of the
 * rule, in `scripts/token-adherence.mjs`, because two copies of a regex are two rules.
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

import {
  COLOUR_MESSAGE,
  COLOUR_PATTERN,
  FONT_MESSAGE,
  FONT_PATTERN,
} from './scripts/token-adherence.mjs';

export default defineConfig(
  globalIgnores([
    'dist/**',
    'coverage/**',
    'node_modules/**',
    // The design system is `.jsx` until Phase C converts it in place (`DEC-21`). Linting it
    // against rules written for the strict `.tsx` it is about to become would report the
    // conversion as hundreds of errors before anybody had started it. `UI-1c` narrowed this from
    // `design-system/**` to the files still waiting, and the list maintains itself from there:
    // a component `UI-1d`-`UI-1h` has converted is no longer a `.jsx`, so it is linted the
    // moment it is renamed and there is no second place to remember to edit.
    'design-system/**/*.jsx',
    // The hand-written prop documentation. Each folds into the component it documents as that
    // component converts, so linting them now is linting something on its way out.
    'design-system/**/*.d.ts',
    // The click-through kit: React 18 and Babel in a browser, and provenance rather than a
    // starting point (`UI-1l`).
    'design-system/ui_kits/**',
    // The typed API surface, written by `npm run api:types` out of the committed document
    // (`UI-3a`). Linting a generated file reports the generator's style as the author's
    // mistakes, and the only fix available is to stop generating it.
    'src/api/schema.ts',
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
      // `console.log` left in a view ships to everybody who opens it. Warnings and errors are
      // allowed, because an error worth swallowing is worth printing.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // --- The application ----------------------------------------------------
  {
    files: ['src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // So a diff shows a change and not a reshuffle. Prettier has no opinion about it,
              // which is why it has to be a lint rule.
              group: ['../*'],
              message: 'Reach up with the `@/` alias rather than with `../`.',
            },
            {
              // `UI-1c`'s criterion, as a rule rather than as a sentence. The barrel is what
              // lets a component move between family folders without a hundred call sites
              // moving with it, and a barrel nobody is held to is a longer path to the same
              // file.
              // `styles.css` is the one thing outside it: it is linked once, from the entry
              // point, and deliberately not re-exported (see design-system/index.ts).
              // A `?raw` stylesheet is the other, added by `UI-32a`: it is not a component
              // reached past the barrel, it is a stylesheet read as text, and the only thing
              // that does it is `interaction-layer.test.tsx` -- which holds every component to
              // what `components.css` claims to own, and would otherwise have to keep a second
              // copy of those claims beside it.
              group: [
                '@/design-system/*',
                '@/design-system/**',
                '!@/design-system/styles.css',
                '!@/design-system/*.css?raw',
              ],
              message:
                'Import from `@/design-system`, not from a file inside it. The two exceptions are `@/design-system/styles.css` from the entry point and a `?raw` stylesheet from a test.',
            },
          ],
        },
      ],
    },
  },

  // --- Every literal the product writes is externalised (`UI-22a`) --------
  //
  // §1.6's rule, as a rule rather than as a sentence. English is the base language and nothing
  // ships in another one yet, but retrofitting externalised strings across thirty views is the
  // one mistake in this plan that cannot be undone cheaply -- so the check exists before the
  // views do, and a bare string in JSX fails the build.
  //
  // Text nodes and the four attributes a person actually reads. It is deliberately not every
  // string attribute: `role`, `type` and a class name are not copy, and a rule that flagged them
  // would be turned off within a week.
  //
  // Tests are exempt: a test asserting on a rendered string has to write the string, and running
  // one through `t()` would be asserting that i18next works.
  {
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/dev/**', 'src/test/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/[A-Za-z]{2,}/]',
          message: "Copy belongs in `src/i18n/en/`, not in a component. Use `t('namespace:key')`.",
        },
        {
          selector:
            'JSXAttribute[name.name=/^(title|placeholder|alt|aria-label|aria-description)$/] > Literal[value=/[A-Za-z]{2,}/]',
          message:
            'This attribute is read by a person or by a screen reader, so it is copy: put it in `src/i18n/en/` and pass `t(...)`.',
        },
      ],
    },
  },

  // --- Tests that read the repository -------------------------------------
  //
  // `*.node.test.ts` checks the shape of the tree rather than the behaviour of a component --
  // that the fonts are shipped, that the token union matches the CSS. Their subject is files at
  // paths, so a path is what they are allowed to use: the alias resolves what the application
  // sees, and what the application sees is exactly what these are not testing.
  {
    files: ['src/**/*.node.test.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },

  // --- The design system --------------------------------------------------
  //
  // It is a library that happens to live in this repository (`DEC-21`), so its files reach each
  // other with relative paths and never through the application's alias. The dependency runs one
  // way: the app imports the system, and the system knows nothing about the app.
  {
    files: ['design-system/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              message:
                'The design system does not import from the application, and reaches itself with a relative path.',
            },
          ],
        },
      ],
    },
  },

  // --- The tokens-only guard (`UI-1i`) ------------------------------------
  //
  // No colour is ever written inside a component, and no font stack either. This is the half that
  // fails in the editor; the other half is a test, and both read the patterns above so they cannot
  // come to disagree. It covers the whole system rather than only `components/`, because
  // `library-colors.ts` and `transcription-states.ts` are exactly where a literal would look
  // least out of place.
  //
  // The two bypasses that predate the rule carry a disable comment naming `UI-33a`, which is the
  // task that removes them. The test's exemption list is the same two, and it fails if either
  // stops existing -- so the excuses cannot outlive the code they excuse.
  {
    files: ['design-system/**/*.{ts,tsx}'],
    ignores: ['design-system/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=/${COLOUR_PATTERN}/]`, message: COLOUR_MESSAGE },
        { selector: `TemplateElement[value.raw=/${COLOUR_PATTERN}/]`, message: COLOUR_MESSAGE },
        { selector: `Literal[value=/${FONT_PATTERN}/]`, message: FONT_MESSAGE },
        { selector: `TemplateElement[value.raw=/${FONT_PATTERN}/]`, message: FONT_MESSAGE },
      ],
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

  // --- Everything that runs in Node ---------------------------------------
  //
  // The config files, and the scripts beside them. The same set tsconfig.node.json names, for
  // the same reason: these have a `process` and the browser half of the codebase does not.
  {
    files: ['*.config.{js,ts}', 'scripts/**'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Last, always: it turns rules off and turning them back on afterwards would be an accident.
  prettier,
);
