/**
 * Every view, mounted the way the application mounts it (`UI-23a`).
 *
 * The cross-cutting pass asks the same question of every screen four times over -- does axe pass,
 * is every control focusable and visibly so, does it hold together at 390px, does it survive
 * strings a third longer -- and each of those is a walk over the same list. Written once here,
 * the list is one thing to keep true; written four times, it is four lists and the fourth is the
 * one nobody updates.
 *
 * Two decisions make the walk worth trusting:
 *
 * **The route table is the real one.** `AppRoutes` is imported from the application rather than
 * restated, so a view added to the router is a view this file can see. The alternative -- a
 * literal list of components -- passes forever after somebody adds a screen, which is the exact
 * failure `UI-23a`'s criterion names.
 *
 * **The providers are the real ones, in the real order.** `main.tsx` puts i18n outside the theme
 * and the theme outside the router; a view audited without its shell is a view audited without
 * its landmarks, its nav and its player, and those are where the accessibility failures actually
 * live. Only the router and the query client differ, and both differ in the way every other test
 * in this repository differs: memory instead of the browser's history, and retries off.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, type RenderResult } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';

import { createQueryClient } from '@/api/query-client';
import { AppRoutes } from '@/app/App';
import { routes, toLibrary, toLibrarySettings, toRecording, toSearch } from '@/app/routes';
import { THEME_STORAGE_KEY, ThemeProvider, type ResolvedTheme } from '@/design-system';
import { createI18n } from '@/i18n';
import { AVIA, CARRER_NOU } from '@/test/api/archive';

/** A screen from the specification's §7, with what it takes to get one on the page. */
export interface ViewUnderTest {
  /** The specification's name for it, which is what a failure should say. */
  name: string;
  /**
   * The module it is defined in, relative to `src/`.
   *
   * Here so the shape test can hold this list to the views that exist on disk rather than to the
   * views somebody remembered.
   */
  module: string;
  /** Where to mount it. A path, so the params come from the URL exactly as they do in a browser. */
  at: string;
  /**
   * Something that is on the page only once the view has its data.
   *
   * Every framed view draws a `PageHeader` immediately, so waiting for the heading would audit a
   * skeleton -- and a skeleton has no controls, which is to say it passes everything. Each entry
   * names a string that arrives with the answer instead.
   */
  settled: string | RegExp;
}

/**
 * The eight screens, in the specification's §7 order.
 *
 * V4 and V8 are absent because they are not routes: the upload dialog and the move sheet are
 * overlays raised from inside another view, and they are audited where they are raised.
 */
export const VIEWS: readonly ViewUnderTest[] = [
  {
    name: 'V1 - Sign in',
    module: 'features/sign-in/SignInView.tsx',
    at: routes.signIn,
    // A field label, not the tagline and not "Sign in". The tagline is drawn by the frame before
    // the instance has answered, so settling on it audits a screen with no form on it; "Sign in"
    // is the heading and the button both.
    settled: 'Email',
  },
  {
    name: 'V2 - Libraries',
    module: 'features/libraries/LibrariesView.tsx',
    at: routes.libraries,
    // A library name would match the sidebar as well as the card.
    settled: 'Name it and pick a colour',
  },
  {
    name: 'V3 - A library',
    module: 'features/library/LibraryView.tsx',
    at: toLibrary(AVIA),
    settled: 'The house on Carrer Nou',
  },
  {
    name: 'V5 - A recording',
    module: 'features/recording/RecordingView.tsx',
    at: toRecording(CARRER_NOU),
    // The title is both the heading and the value in the metadata panel, so settle on the
    // transcript instead -- which is the part that arrives last anyway.
    settled: 'Click a line to jump there.',
  },
  {
    name: 'V6 - Search',
    module: 'features/search/SearchView.tsx',
    // A query the mock index actually answers, because the state worth auditing is a page of
    // results and not the empty one.
    at: toSearch('carrer'),
    settled: /la casa del carrer Nou/,
  },
  {
    name: 'V7 - Library settings',
    module: 'features/library-settings/LibrarySettingsView.tsx',
    at: toLibrarySettings(AVIA),
    settled: 'Library settings',
  },
  {
    name: 'V9 - Trash',
    module: 'features/trash/TrashView.tsx',
    at: routes.trash,
    settled: 'Nothing is waiting to be deleted',
  },
  {
    name: 'V10 - Settings',
    module: 'features/settings/SettingsView.tsx',
    at: routes.settings,
    settled: 'Appearance',
  },
];

/**
 * Give every scroller a viewport, because jsdom performs no layout.
 *
 * The recording list and the transcript are virtualised. A virtualiser asked how tall its
 * scroller is hears zero and draws **no rows at all** -- so a walk over V3 or V5 would audit a
 * library with no recordings in it and a transcript with no lines, and pass having checked the
 * page furniture. Every assertion would be green and none of them would be about the content.
 *
 * Done once at module scope rather than per test, and with `defineProperty` rather than a spy:
 * nothing here needs restoring between tests, because there is no real value being shadowed --
 * jsdom's answer is zero and it is zero for everybody. Only the files that mount views import
 * this module, so no component test inherits it.
 */
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get: () => 720,
});
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    writable: true,
    value: class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    },
  });
}

/** How wide the window is, which decides which of the two shells a view is drawn in. */
export const DESKTOP = 1440;

/**
 * A phone, in CSS pixels.
 *
 * 390 is the iPhone 12-through-16 width and the narrowest mainstream device still sold, so it is
 * the one worth failing at. Anything that holds here holds on a Pixel.
 */
export const PHONE = 390;

export interface MountOptions {
  /** Which theme to render in. Seeded the way a returning visitor's browser seeds it. */
  theme?: ResolvedTheme;
  /** How wide the window claims to be. */
  width?: number;
  /** Which language, so the pseudo-locale pass can ask for one that is a third longer. */
  language?: string;
}

/**
 * Tell jsdom how wide it is.
 *
 * jsdom reports 1024 and never changes it, which is below `--breakpoint-sidebar` and above every
 * phone breakpoint -- so by default every view renders in a layout that is neither of the two
 * this pass is about. Nothing here paints, so this only moves the answers the components read
 * through `matchMedia` and `innerWidth`; that is enough, because the branches under test are
 * branches in the components rather than in a stylesheet.
 */
function widen(width: number): void {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      const max = /max-width:\s*(\d+)px/.exec(query)?.[1];
      const min = /min-width:\s*(\d+)px/.exec(query)?.[1];
      const matches =
        (max === undefined || width <= Number(max)) && (min === undefined || width >= Number(min));
      return {
        matches,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}

/**
 * Put a view on the page and wait until it has its data.
 *
 * Returns Testing Library's result rather than a container, because what the callers do next
 * differs: axe wants the DOM, the focus walk wants the elements, and the pseudo-locale pass wants
 * to read the strings back out.
 */
export async function mountView(
  view: ViewUnderTest,
  { theme = 'dark', width = DESKTOP, language = 'en' }: MountOptions = {},
): Promise<RenderResult> {
  widen(width);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  const result = render(
    <I18nextProvider i18n={createI18n(language)}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[view.at]}>
          <QueryClientProvider client={client}>
            <AppRoutes />
          </QueryClientProvider>
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>,
  );
  await screen.findByText(view.settled, undefined, { timeout: 5000 });
  return result;
}
