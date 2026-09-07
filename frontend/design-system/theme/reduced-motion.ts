import { useSyncExternalStore } from 'react';

/**
 * Whether the device is asking for less movement (`UI-32c`).
 *
 * `prefers-reduced-motion` is honoured declaratively almost everywhere in this system: the two
 * duration tokens zero themselves under it in `tokens/motion.css`, and every transition in every
 * component is written in terms of one of them, so a hover that fades becomes a hover that
 * switches and nothing else has to be done about it.
 *
 * **Almost. A script that scrolls has to ask.** The transcript following playback is the only
 * thing in the product that moves on its own -- §1.7 says so, and calls it the case that matters
 * -- and it moves by calling `scrollIntoView` or `scrollTo`, which consult neither a token nor
 * the `scroll-behavior` this system sets. Passing `behavior: 'smooth'` scrolls smoothly for
 * somebody who asked for nothing to move, and no stylesheet can intervene. This hook is what
 * `UI-12b` reads instead, and it exists before its consumer because the alternative is a hook
 * written in a hurry inside a view.
 *
 * `useSyncExternalStore` for the same reason `ThemeProvider` uses it for the colour scheme: this
 * is state outside React that changes without being asked, and re-reading on subscribe is what
 * stops the window between the first render and the listener leaving a stale answer on screen.
 * Unlike the theme it takes no provider -- there is nothing to choose, no override, and no
 * persistence. The device is the only opinion.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, onServer);
}

/** The query, in one place, because a typo in it reads as "nobody asked for this". */
const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether reduced motion is asked for right now.
 *
 * False wherever `matchMedia` is not implemented -- jsdom without a stub, an older test
 * environment -- because the interface still has to render, and the answer that renders it the
 * way it was designed is the safer default of the two.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(QUERY).matches;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** On a server there is no device to ask. */
function onServer(): boolean {
  return false;
}

/**
 * The scroll behaviour to ask for, given the preference.
 *
 * A one-line helper rather than a comment, because the mistake it prevents is the whole of
 * `UI-32c`: `behavior: 'smooth'` written as a literal at a call site is a movement that survives
 * every stylesheet, every token and every media query. A call site that reads
 * `scrollBehaviour(reduced)` cannot forget.
 */
export function scrollBehaviour(reduced: boolean): ScrollBehavior {
  return reduced ? 'auto' : 'smooth';
}
