/**
 * Light, dark, or follow the system -- and nothing else (`UI-1j`).
 *
 * Three states, and the third one is the interesting one. **Following the system means writing no
 * attribute at all.** `tokens/semantic.css` selects the light palette either from
 * `[data-theme="light"]` or from `prefers-color-scheme: light` on a document with no `data-theme`,
 * so the absence of the attribute is not a missing value -- it is the choice. Writing `dark` there
 * because the system happens to say dark would freeze today's answer into a device that is going
 * to change its mind at sunset.
 *
 * **The choice is per device**, in `localStorage` rather than on the account, because it is a
 * property of the screen somebody is looking at. The same person on a laptop in a bright room and
 * a phone in bed wants two different answers, and an account-level setting can only be wrong for
 * one of them. `UI-20d` says the same thing from the Settings side.
 *
 * Every `localStorage` call is wrapped. It throws rather than returning null in a Safari private
 * window and wherever site data is blocked, and a theme preference is a convenience -- the one
 * thing it must never do is stop the interface from rendering.
 */

import { createContext, use } from 'react';

/**
 * The key, and the reason it appears twice.
 *
 * `index.html` reads it in a script that runs before the bundle, so that somebody who chose light
 * does not get a dark page for the length of a network round trip. That copy cannot import this
 * one, so `theme.node.test.ts` asserts the two agree.
 */
export const THEME_STORAGE_KEY = 'resonand-theme';

export const THEME_CHOICES = ['light', 'dark', 'system'] as const;

/** What somebody chose. */
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** What they are actually looking at. `system` resolves to one of these. */
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeState {
  /** The choice, including `system`. This is what a settings control binds to. */
  choice: ThemeChoice;
  /** What is on screen right now. `system` resolved against `prefers-color-scheme`. */
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

/**
 * The current theme and the way to change it.
 *
 * Throws outside a `ThemeProvider` rather than handing back a default. A component that silently
 * gets `dark` because nobody wrapped it is a bug that shows up as a screenshot review comment
 * months later.
 */
export function useTheme(): ThemeState {
  const state = use(ThemeContext);
  if (state === null) {
    throw new Error('useTheme was called outside a ThemeProvider.');
  }
  return state;
}

/** Whether the device is asking for light. False wherever `matchMedia` is not implemented. */
export function systemPrefersLight(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: light)').matches;
}

/** The stored choice, or `system` -- which is also what an unreadable store means. */
export function readStoredChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** Persist the choice, or forget it. `system` stores nothing, because it is the absence. */
export function storeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, choice);
    }
  } catch {
    // A preference that could not be saved is a preference that lasts until reload. The
    // interface still renders, which is the part that matters.
  }
}

/**
 * Put the choice on the document.
 *
 * `color-scheme` goes with it, so the scrollbars, the form controls and the canvas the browser
 * paints behind the page agree with the tokens. Following the system removes both and lets the
 * `<meta name="color-scheme">` in `index.html` say that either is fine.
 */
export function applyChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
    root.style.removeProperty('color-scheme');
  } else {
    root.setAttribute('data-theme', choice);
    root.style.setProperty('color-scheme', choice);
  }
}
