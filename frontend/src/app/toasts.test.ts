/**
 * What the product says when a write fails (`FBK-1`).
 *
 * The collapsing is the part worth a test. Two hundred recordings moved one request at a time is
 * two hundred chances to fail the same way, and a stack of two hundred identical toasts is a live
 * region nobody can follow and a screen nobody can dismiss.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { useToasts, raiseToast } from './toasts';

beforeEach(() => {
  useToasts.setState({ toasts: [] });
});

describe('saying something happened', () => {
  it('holds what was raised, in the order it was raised', () => {
    raiseToast({ tone: 'failed', message: 'That library already exists.' });
    raiseToast({ tone: 'done', message: 'Moved.' });
    expect(useToasts.getState().toasts.map((one) => one.message)).toEqual([
      'That library already exists.',
      'Moved.',
    ]);
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
    expect(useToasts.getState().toasts).toHaveLength(2);
  });

  it('takes one away without disturbing the rest', () => {
    const first = raiseToast({ tone: 'failed', message: 'One.' });
    raiseToast({ tone: 'failed', message: 'Two.' });
    useToasts.getState().dismiss(first);
    expect(useToasts.getState().toasts.map((one) => one.message)).toEqual(['Two.']);
  });

  it('ignores being asked to dismiss something that is not showing', () => {
    raiseToast({ tone: 'failed', message: 'One.' });
    useToasts.getState().dismiss('not an id');
    expect(useToasts.getState().toasts).toHaveLength(1);
  });
});
