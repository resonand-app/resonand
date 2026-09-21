/**
 * Whether the metadata panel is out (`UI-11c`, §V5).
 *
 * Remembered, for the reason the sidebar's collapse is remembered: a panel that comes back every
 * time it is dismissed is a control somebody dismisses every time. And **per device rather than
 * per account**, like the theme -- how much of a 1280px screen the transcript should have is a
 * property of the screen somebody is reading on, not of who they are.
 *
 * Storage can refuse. A private window, cleared site data, a browser set to block it -- all three
 * are a panel that is simply out, which is the state the screen was designed around.
 */

import { useCallback, useState } from 'react';

const REMEMBERED = 'resonand.metadata-collapsed';

export interface PanelState {
  collapsed: boolean;
  toggle: () => void;
}

export function usePanel(): PanelState {
  const [collapsed, setCollapsed] = useState(remembered);

  const toggle = useCallback(() => {
    setCollapsed((was) => {
      remember(!was);
      return !was;
    });
  }, []);

  return { collapsed, toggle };
}

function remembered(): boolean {
  try {
    return window.localStorage.getItem(REMEMBERED) === 'true';
  } catch {
    return false;
  }
}

function remember(collapsed: boolean): void {
  try {
    window.localStorage.setItem(REMEMBERED, String(collapsed));
  } catch {
    // Nothing to do about it, and nothing worth telling anybody.
  }
}
