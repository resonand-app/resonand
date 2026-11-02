/**
 * What the product says when a write fails (`FBK-1`).
 *
 * The collapsing is the part worth a test. Two hundred recordings moved one request at a time is
 * two hundred chances to fail the same way, and a stack of two hundred identical toasts is a live
 * region nobody can follow and a screen nobody can dismiss.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { ACTION_AFTER_MS, FAILED_AFTER_MS, raiseToast, timeoutOf, useToasts } from '../toasts';

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

describe('saying something happened', () => {
  it('shows one at a time, the newer replacing the older (UI-46)', () => {
    raiseToast({ tone: 'failed', message: 'That library already exists.' });
    raiseToast({ tone: 'done', message: 'Moved.' });
    expect(useToasts.getState().toasts.map((one) => one.message)).toEqual(['Moved.']);
  });

  it('does not stack the same sentence twice', () => {
    const first = raiseToast({ tone: 'failed', message: 'The instance could not be reached.' });
    const again = raiseToast({ tone: 'failed', message: 'The instance could not be reached.' });
    expect(useToasts.getState().toasts).toHaveLength(1);
    expect(again).toBe(first);
  });

  it('treats the same words in a different tone as a different thing to say', () => {
    raiseToast({ tone: 'failed', message: 'Moved.' });
    raiseToast({ tone: 'done', message: 'Moved.' });
    expect(useToasts.getState().toasts).toEqual([
      expect.objectContaining({ tone: 'done', message: 'Moved.' }),
    ]);
  });

  it('takes it away when dismissed', () => {
    const one = raiseToast({ tone: 'failed', message: 'One.' });
    useToasts.getState().dismiss(one);
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('ignores being asked to dismiss something that is not showing', () => {
    raiseToast({ tone: 'failed', message: 'One.' });
    useToasts.getState().dismiss('not an id');
    expect(useToasts.getState().toasts).toHaveLength(1);
  });

  it('raises the same words again when they carry an action', () => {
    // Each Undo belongs to its own run; keeping the first would undo the wrong one.
    const first = { label: 'Undo', run: () => undefined };
    const second = { label: 'Undo', run: () => undefined };
    raiseToast({ tone: 'done', message: 'One recording sent to the trash', action: first });
    raiseToast({ tone: 'done', message: 'One recording sent to the trash', action: second });
    expect(useToasts.getState().toasts.map((one) => one.action)).toEqual([second]);
  });
});

describe('how long a toast stays (UI-46)', () => {
  const action = { label: 'Retry', run: () => undefined };

  it('leaves a plain success to the region default', () => {
    expect(timeoutOf({ tone: 'done' })).toBeUndefined();
  });

  it('keeps a success with a button longer than the default', () => {
    expect(timeoutOf({ tone: 'done', action })).toBe(ACTION_AFTER_MS);
    expect(ACTION_AFTER_MS).toBeGreaterThan(6000);
  });

  it('keeps a failure for a while, and a failure with a button until it is dismissed', () => {
    expect(timeoutOf({ tone: 'failed' })).toBe(FAILED_AFTER_MS);
    expect(timeoutOf({ tone: 'failed', action })).toBeNull();
  });
});
