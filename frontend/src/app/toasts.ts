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
 * **One at a time: a newer toast replaces the one showing** (`UI-46`). What is on screen is always
 * the latest answer to "did that work?", and a stack is a set of older answers somebody has to read
 * past to find it. An identical message already showing is kept rather than raised again, so two
 * hundred writes failing the same way do not flicker one sentence two hundred times -- unless it
 * carries an action, which belongs to the run that raised it: a second run's *Undo* is raised as
 * its own toast, because keeping the first's would undo the wrong thing.
 *
 * **A toast with a button stays longer** (`UI-46`). An action nobody had time to read is an action
 * nobody was offered, so a success with one stays twice the region's default, and a failure with
 * one stays until it is dismissed.
 */

import { create } from 'zustand';

/** How long a failure stays. Longer than the region's default: it is a sentence, not a tick. */
export const FAILED_AFTER_MS = 12_000;

/** How long a success carrying an action stays. */
export const ACTION_AFTER_MS = 12_000;

export interface ToastAction {
  label: string;
  /** Called once the toast has been taken away. */
  run: () => void;
}

export interface RaisedToast {
  id: string;
  tone: 'done' | 'failed';
  /** One sentence, already written for a person. The API's `detail`, or the view's own words. */
  message: string;
  /** One thing to do about it: *Undo* after a success, *Retry* after a failure. */
  action?: ToastAction;
}

/** Milliseconds until it goes, `null` for never, `undefined` for the region's own default. */
export function timeoutOf(toast: Pick<RaisedToast, 'tone' | 'action'>): number | null | undefined {
  if (toast.tone === 'failed') return toast.action === undefined ? FAILED_AFTER_MS : null;
  return toast.action === undefined ? undefined : ACTION_AFTER_MS;
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

  raise: (toast) => {
    const showing =
      toast.action === undefined
        ? get().toasts.find(
            (one) =>
              one.action === undefined && one.message === toast.message && one.tone === toast.tone,
          )
        : undefined;
    if (showing !== undefined) return showing.id;
    sequence += 1;
    const id = String(sequence);
    set({ toasts: [{ ...toast, id }] });
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
