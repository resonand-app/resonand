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
import { expect } from 'vitest';
import { render, screen, waitFor, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { UserEvent } from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router';

import { createQueryClient } from '@/api/query-client';
import { AppRoutes } from '@/app/App';
import { routes, toLibrary, toLibrarySettings, toRecording, toSearch } from '@/app/routes';
import { THEME_STORAGE_KEY, ThemeProvider, type ResolvedTheme } from '@/design-system';
import { SECTION_PARAM } from '@/features/settings/sections';
import { createI18n } from '@/i18n';
import { archive, CASSETTE, MEETINGS, RECORDINGS, FIELD_TAKE } from '@/test/api/archive';

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
  /**
   * A selector that must also match before the view counts as drawn.
   *
   * For the views whose only unambiguous text marker arrives before their data does. V2 is the
   * case that put this here: its settle string belongs to the create-a-library card, which is
   * drawn immediately, so the audits were running against a page with no libraries on it and
   * passing. A selector says "the content is here" in a way no wording can.
   */
  drawn?: string;
}

/**
 * The eight screens, in the specification's §7 order.
 *
 * V4 and V8 are absent because they are not routes: the upload dialog and the move sheet are
 * overlays raised from inside another view. They are in `STATES` below, which is what makes
 * that sentence true: it was written here long before anything raised either of them.
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
    // A library name would match the sidebar as well as the card, so the text marker is the
    // create-a-library card -- which is drawn before the libraries are, hence `drawn`.
    settled: 'Name it and pick a colour',
    drawn: '[data-ds="library-card"]',
  },
  {
    name: 'V3 - A library',
    module: 'features/library/LibraryView.tsx',
    at: toLibrary(RECORDINGS),
    settled: 'Field recording, long take',
  },
  {
    name: 'V5 - A recording',
    module: 'features/recording/RecordingView.tsx',
    at: toRecording(FIELD_TAKE),
    // The title is both the heading and the value in the metadata panel, so settle on the
    // transcript instead -- which is the part that arrives last anyway.
    settled: 'Click a line to jump there.',
  },
  {
    name: 'V6 - Search',
    module: 'features/search/SearchView.tsx',
    // A query the mock index actually answers, because the state worth auditing is a page of
    // results and not the empty one.
    at: toSearch('rehearsal'),
    settled: /the third segment mentions rehearsal/,
  },
  {
    name: 'V7 - Library settings',
    module: 'features/library-settings/LibrarySettingsView.tsx',
    at: toLibrarySettings(RECORDINGS),
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
  const selector = view.drawn;
  if (selector !== undefined) {
    await waitFor(() => {
      expect(
        document.querySelector(selector),
        `${view.name} never drew ${selector}`,
      ).not.toBeNull();
    });
  }
  return result;
}

/**
 * The view named, so a state can say which screen it is a state of.
 *
 * Resolved at module scope rather than inside the walk, so a name that no longer matches fails
 * on import rather than as one entry of a `describe.each` that silently never ran.
 */
function view(name: string): ViewUnderTest {
  const found = VIEWS.find((one) => one.name === name);
  if (found === undefined) throw new Error(`${name} is missing from VIEWS.`);
  return found;
}

/**
 * A state of a view that a URL alone does not reach (`UI-23a1`).
 *
 * `VIEWS` is the eight screens as somebody first meets them, and for the cross-cutting pass that
 * was taken to be the whole surface. It is not. An overlay is raised by a click and a panel is
 * reached by a query parameter, so the audit walked eight first impressions -- a trash that was
 * always empty, a settings screen that was always on Account, and two dialogs the harness
 * claimed were "audited where they are raised" while nothing raised either.
 *
 * A state is therefore a view plus the three things that get it into the state worth auditing:
 * what the archive has to hold first, what to click, and what is on the page once it worked.
 * `every-view-is-audited.node.test.ts` holds this list to the overlays and sections that exist,
 * the same way it holds `VIEWS` to the view modules on disk.
 *
 * **Only the axe pass walks this.** The focus walk, the 390px pass, the +30% locale and the 44px
 * target check still walk `VIEWS` alone: each of those asks a question a dialog deserves too, and
 * each would be a separate set of findings. The shape here does not stop them being added; it is
 * the reason it is a list rather than a handful of tests written out longhand.
 */
export interface StateUnderTest {
  /** What the state is, which is what a failure should say. */
  name: string;
  /** The view it is a state of. */
  of: ViewUnderTest;
  /**
   * The overlay module this state puts on the page, relative to `src/`.
   *
   * Here for the shape test, and absent when the state is another state of the view itself
   * rather than something drawn over it.
   */
  draws?: string;
  /** Where to mount, when the state is a query parameter away. The view's own address otherwise. */
  at?: string;
  /**
   * What says the view is drawn, when this state changes the answer.
   *
   * V9 settles on its empty state, which is precisely what a trash with rows in it is not -- so
   * a state that alters the view's own content has to say what to wait for instead.
   */
  settled?: string | RegExp;
  /** What the archive has to hold before anything is mounted. */
  prepare?: () => void;
  /** What to do once the view has settled, to raise the state. */
  raise?: (user: UserEvent) => Promise<void>;
  /** Something that is on the page only once the state itself is there. */
  reached: string | RegExp;
}

/** Press the control with this accessible name, once it is on the page. */
async function press(user: UserEvent, name: string | RegExp): Promise<void> {
  await user.click(await screen.findByRole('button', { name }));
}

/**
 * Press a control in the view rather than in the frame around it.
 *
 * The sidebar has a Trash destination and a recording has a Trash action, and they carry the same
 * name because they are the same word for the same thing. The landmark is what tells them apart.
 */
async function pressInView(user: UserEvent, name: string | RegExp): Promise<void> {
  await user.click(await within(screen.getByRole('main')).findByRole('button', { name }));
}

/** How long ago, as the API writes an instant. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Put something in the trash, so V9 has rows rather than its good empty state. */
function fillTheTrash(): void {
  archive.recordings = archive.recordings.map((one) =>
    one.uuid === CASSETTE ? { ...one, deleted_at: daysAgo(3) } : one,
  );
  archive.libraries = archive.libraries.map((one) =>
    one.uuid === MEETINGS ? { ...one, deleted_at: daysAgo(28) } : one,
  );
}

/** Every state behind a trigger or a parameter, in the order of the views they belong to. */
export const STATES: readonly StateUnderTest[] = [
  {
    name: 'V4 - Upload audio',
    of: view('V2 - Libraries'),
    draws: 'features/upload/UploadDialog.tsx',
    // From the top bar rather than from an empty state, because that is the one entry point
    // every screen has -- the dialog belongs to the frame and not to whatever is under it.
    raise: (user) => press(user, 'Upload recordings'),
    reached: 'Drop files here, or choose them',
  },
  {
    name: 'V2 - Create a library',
    of: view('V2 - Libraries'),
    draws: 'features/libraries/CreateLibraryDialog.tsx',
    raise: (user) => press(user, /Create a library/),
    reached: 'Nothing in a library is shared until you share it.',
  },
  {
    name: 'V8 - Move a recording',
    of: view('V5 - A recording'),
    draws: 'components/MoveDialog.tsx',
    // One recording, from the detail view. The library's bulk bar opens the same module with a
    // selection in it, which is a different sentence in the title and the same markup around it.
    raise: (user) => press(user, 'Move to another library'),
    reached: 'Move this recording',
  },
  {
    name: 'V5 - Send a recording to the trash',
    of: view('V5 - A recording'),
    draws: 'features/recording/RecordingActions.tsx',
    raise: (user) => pressInView(user, 'Trash'),
    reached: 'Send this recording to the trash?',
  },
  {
    name: 'V7 - Remove somebody',
    of: view('V7 - Library settings'),
    draws: 'features/library-settings/SharePanel.tsx',
    raise: (user) => press(user, 'Remove Sam Rivera'),
    reached: 'Remove Sam Rivera?',
  },
  {
    name: 'V7 - Delete a category',
    of: view('V7 - Library settings'),
    draws: 'features/library-settings/CategoryTree.tsx',
    raise: (user) => press(user, 'Delete Interviews'),
    reached: 'Delete Interviews?',
  },
  {
    name: 'V7 - Move the library to the trash',
    of: view('V7 - Library settings'),
    draws: 'components/TrashLibraryDialog.tsx',
    raise: (user) => press(user, 'Move this library to the trash'),
    reached: 'Move Field recordings to the trash?',
  },
  {
    name: 'V9 - Trash, with things in it',
    of: view('V9 - Trash'),
    prepare: fillTheTrash,
    settled: 'Digitised cassette',
    reached: 'Digitised cassette',
  },
  {
    name: 'V9 - Delete permanently',
    of: view('V9 - Trash'),
    draws: 'features/trash/TrashRow.tsx',
    prepare: fillTheTrash,
    settled: 'Digitised cassette',
    raise: (user) => press(user, 'Delete Digitised cassette permanently'),
    reached: 'Delete Digitised cassette permanently',
  },
  {
    name: 'V10 - Sessions',
    of: view('V10 - Settings'),
    at: `${routes.settings}?${SECTION_PARAM}=sessions`,
    reached: 'Where you are signed in',
  },
  {
    name: 'V10 - Sign out everywhere else',
    of: view('V10 - Settings'),
    draws: 'features/settings/SessionsPanel.tsx',
    at: `${routes.settings}?${SECTION_PARAM}=sessions`,
    raise: (user) => press(user, 'Sign out everywhere else'),
    reached: 'Sign out of every device except this one?',
  },
  {
    name: 'V10 - Appearance',
    of: view('V10 - Settings'),
    at: `${routes.settings}?${SECTION_PARAM}=appearance`,
    reached: 'Saved on this device, because it is a property of the screen you are looking at.',
  },
  {
    name: 'V10 - Administration',
    of: view('V10 - Settings'),
    at: `${routes.settings}?${SECTION_PARAM}=administration`,
    reached: 'Accounts are made here, by hand, for people you know. There is no sign-up page.',
  },
  {
    name: 'V10 - Set somebody a password',
    of: view('V10 - Settings'),
    draws: 'features/settings/administration/SetPasswordDialog.tsx',
    at: `${routes.settings}?${SECTION_PARAM}=administration`,
    raise: (user) => press(user, 'Set a password for Sam Rivera'),
    reached: /This is the only way back into an account/,
  },
];

/**
 * Put a view on the page and get it into one of its states.
 *
 * The archive is prepared before the render rather than after it, because every fixture a view
 * reads is read by a request the render starts: a trash filled afterwards is a trash the screen
 * has already been told is empty.
 */
export async function mountState(
  state: StateUnderTest,
  options: MountOptions = {},
): Promise<RenderResult> {
  state.prepare?.();
  const result = await mountView(
    {
      ...state.of,
      ...(state.at === undefined ? {} : { at: state.at }),
      ...(state.settled === undefined ? {} : { settled: state.settled }),
    },
    options,
  );
  if (state.raise !== undefined) await state.raise(userEvent.setup());
  await screen.findByText(state.reached, undefined, { timeout: 5000 });
  // A state that claims an overlay has to have one on the page. `reached` on its own would also
  // be satisfied by text the view underneath already carried, and a trigger that quietly stopped
  // working would then go on auditing the view -- which is the failure this whole task is about.
  if (state.draws !== undefined) expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  return result;
}
