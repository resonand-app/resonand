/**
 * Every literal the product writes, in one place per view (`UI-22a`, §1.6).
 *
 * English is the base language and the only one that ships in v0 (`UI-36` is where others
 * arrive), but every string is externalised now rather than later: retrofitting thirty views is
 * the one mistake in this plan that cannot be undone cheaply, and an ESLint rule fails on a bare
 * string in JSX so it cannot start happening again.
 *
 * **One namespace per view.** `common` holds what several views say -- an action's name, a
 * transcription state, the sentence for an instance that did not answer -- and each view adds a
 * namespace of its own as it is built. The reason is not tidiness: a translator opening
 * `library.json` sees one screen's worth of strings in the order they appear on it, which is the
 * difference between a translation that reads and one that is technically correct.
 *
 * **User content is never in here.** Library names, recording titles, tags and transcripts are
 * shown exactly as entered, accents and all (§1.5). This file is the product's own voice.
 */

import i18n from 'i18next';
import type { i18n as I18n } from 'i18next';
import { initReactI18next } from 'react-i18next';

import common from './en/common.json';
import libraries from './en/libraries.json';
import library from './en/library.json';
import librarySettings from './en/librarySettings.json';
import move from './en/move.json';
import player from './en/player.json';
import recording from './en/recording.json';
import search from './en/search.json';
import settings from './en/settings.json';
import shell from './en/shell.json';
import signIn from './en/signIn.json';
import upload from './en/upload.json';
import { pseudoBundle } from './pseudo';

/** The language every string is written in, and the one every other one is checked against. */
export const BASE = 'en';

/**
 * The generated `+30%` locale (`UI-22d`).
 *
 * Development only. It is selected with `?lang=pseudo` or by putting `pseudo` in the language
 * preference, and it is what makes the length check `UI-24c` performs a switch.
 */
export const PSEUDO = 'pseudo';

export const NAMESPACES = [
  'common',
  'libraries',
  'library',
  'librarySettings',
  'move',
  'player',
  'recording',
  'search',
  'settings',
  'shell',
  'signIn',
  'upload',
] as const;

const english = {
  common,
  libraries,
  library,
  librarySettings,
  move,
  player,
  recording,
  search,
  settings,
  shell,
  signIn,
  upload,
};

export const resources = {
  [BASE]: english,
  [PSEUDO]: pseudoBundle(english) as typeof english,
};

/**
 * Which language to start in.
 *
 * The account's own preference wins once there is a session (`V10` sets it through
 * `changeLanguage`), so this is only the answer before anybody has signed in: an explicit
 * override in development, then what the browser asks for, then English.
 */
export function initialLanguage(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
  isDevelopment: boolean = import.meta.env.DEV,
): string {
  const asked = new URLSearchParams(search).get('lang');
  if (asked !== null && (asked !== PSEUDO || isDevelopment)) return asked;
  const known = languages.find((one) => one.split('-')[0] === BASE);
  return known ?? BASE;
}

export function createI18n(language: string = initialLanguage()): I18n {
  const instance = i18n.createInstance();
  void instance.use(initReactI18next).init({
    lng: language,
    fallbackLng: BASE,
    defaultNS: 'common',
    ns: [...NAMESPACES],
    resources,
    // The interface escapes what it renders because React does; asking i18next to do it again
    // turns an apostrophe in a library's name into `&#39;`.
    interpolation: { escapeValue: false },
    // A missing key is a bug and reads like one. Falling back to the key itself is what makes it
    // visible in a screenshot rather than an empty space nobody notices.
    parseMissingKeyHandler: (key) => key,
    returnNull: false,
  });
  return instance;
}

export default createI18n;
