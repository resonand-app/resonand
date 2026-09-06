import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import {
  applyChoice,
  readStoredChoice,
  storeChoice,
  systemPrefersLight,
  ThemeContext,
} from './theme';
import type { ThemeChoice, ThemeState } from './theme';

/**
 * Subscribe to the device changing its mind.
 *
 * `prefers-color-scheme` is state that lives outside React and changes without being asked, which
 * is precisely what `useSyncExternalStore` is for -- it re-reads on subscribe, so the window
 * between the first render and the listener being attached cannot leave a stale answer on screen.
 */
function subscribeToScheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia('(prefers-color-scheme: light)');
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/** On a server there is no device to ask, and dark is the default. */
function schemeOnServer(): boolean {
  return false;
}

export interface ThemeProviderProps {
  children?: ReactNode;
}

/**
 * Holds the theme choice and keeps the document in step with it (`UI-1j`).
 *
 * The initial value is read from `localStorage` during the first render rather than in an effect,
 * because an effect runs after the first paint and the first paint is exactly what a theme
 * decides. `index.html` has already put the attribute on the document before the bundle loaded;
 * this reads the same key so the two agree and nothing flashes.
 *
 * It subscribes to `prefers-color-scheme` whatever the choice is, so `resolved` is right the
 * moment a device switches at sunset -- and it is `resolved`, not `choice`, that a label reads.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredChoice);
  const prefersLight = useSyncExternalStore(subscribeToScheme, systemPrefersLight, schemeOnServer);

  useEffect(() => {
    applyChoice(choice);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    storeChoice(next);
    setChoiceState(next);
  }, []);

  const value = useMemo<ThemeState>(
    () => ({
      choice,
      resolved: choice === 'system' ? (prefersLight ? 'light' : 'dark') : choice,
      setChoice,
    }),
    [choice, prefersLight, setChoice],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
