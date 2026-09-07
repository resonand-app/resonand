/**
 * The one keyboard handler (`UI-4g`, §1.8).
 *
 * Installed once by the shell and handed a set of actions. A view that wants a binding provides
 * the action; it does not add a listener of its own, and there is nowhere in the interface where
 * two handlers could disagree about the same key.
 *
 * A command with nobody to answer it does nothing and does **not** swallow the key: with no
 * transcript on screen, `↑` and `↓` are the browser's and scroll the page, which is what somebody
 * pressing them on a long list means by it.
 */

import { useEffect, useRef } from 'react';

import { commandFor, interactive } from './keyboard';
import type { Command } from './keyboard';

export type Actions = Partial<Record<Command, () => void>>;

export function useKeyboard(actions: Actions): void {
  // Through a ref so the listener is installed once: actions are rebuilt every render, and
  // re-subscribing on each of them would drop a key press landing in the gap.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  }, [actions]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = commandFor(event);
      if (command === null) return;
      // A focused button answers Enter and Space itself. Acting here as well would open a
      // recording and toggle playback on one press of the same key.
      if ((command === 'open' || command === 'toggle-selection') && interactive(event.target)) {
        return;
      }
      if (command === 'play-pause' && interactive(event.target)) return;
      const act = latest.current[command];
      if (act === undefined) return;
      event.preventDefault();
      act();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);
}
