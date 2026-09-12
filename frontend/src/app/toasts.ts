/**
 * What the product says when something has already happened (`FBK-1`, `UI-34h`, `UI-35f`).
 *
 * A store outside React, beside the upload tray's and for the same reason: the thing that raises a
 * toast is often not a component. A write that failed is caught by the query client's mutation
 * cache, which has no hooks to call and no view to be inside, and a toast raised from there has to
 * reach a region that is mounted somewhere else entirely.
 *
 * **A toast is never the only place a result exists** (`Toast`). It is a courtesy for somebody who
 * was looking elsewhere, and it is gone in seconds; the recordings that failed to move are still
 * selected, the file that did not upload is still in the tray. Nothing here is a substitute for a
 * state on the screen, and anything that would be belongs on the screen instead.
 *
 * **An identical message already showing is not raised twice.** Two hundred recordings moved one
 * request at a time is two hundred chances to fail the same way, and a stack of two hundred toasts
 * saying the same sentence is a screen nobody can dismiss and a live region nobody can follow.
 */

import { create } from 'zustand';

/** How long a failure stays. Longer than the region's default: it is a sentence, not a tick. */
export const FAILED_AFTER_MS = 12_000;

export interface RaisedToast {
  id: string;
  tone: 'done' | 'failed';
  /** One sentence, already written for a person. The API's `detail`, or the view's own words. */
  message: string;
}

export interface ToastsState {
  toasts: RaisedToast[];
  /** Say something happened. Answers the id, so a caller that wants it back can take it away. */
  raise: (toast: Omit<RaisedToast, 'id'>) => string;
  dismiss: (id: string) => void;
}

let sequence = 0;

export const useToasts = create<ToastsState>((set, get) => ({
  toasts: [],

  raise: ({ tone, message }) => {
    const showing = get().toasts.find((one) => one.message === message && one.tone === tone);
    if (showing !== undefined) return showing.id;
    sequence += 1;
    const id = String(sequence);
    set((state) => ({ toasts: [...state.toasts, { id, tone, message }] }));
    return id;
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((one) => one.id !== id) }));
  },
}));

/** Raise one from outside React, which is where most failures are caught. */
export function raiseToast(toast: Omit<RaisedToast, 'id'>): string {
  return useToasts.getState().raise(toast);
}
