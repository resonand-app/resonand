/**
 * The selection model (`UI-9a`, `UI-9c`, `UI-9d`, §V3).
 *
 * Pure arithmetic over a set of uuids, so it is tested directly. The cases worth holding are the
 * ones a click cannot easily produce on demand: a range measured backwards, a second range that
 * has to add rather than replace, and what is left selected after a partial failure.
 */

import { describe, expect, it } from 'vitest';

import { EMPTY, coverage, extendTo, retain, selectAll, toggle } from './selection';

const ORDER = ['a', 'b', 'c', 'd', 'e'];

const of = (...uuids: string[]) => ({ selected: new Set(uuids), anchor: uuids.at(-1) ?? null });

describe('toggling', () => {
  it('turns one on, and remembers where the click was', () => {
    const next = toggle(EMPTY, 'b');
    expect([...next.selected]).toEqual(['b']);
    expect(next.anchor).toBe('b');
  });

  it('turns one off again', () => {
    expect([...toggle(of('b'), 'b').selected]).toEqual([]);
  });
});

describe('a range', () => {
  it('covers everything between the last click and this one', () => {
    const next = extendTo(of('b'), 'd', ORDER);
    expect([...next.selected].sort()).toEqual(['b', 'c', 'd']);
  });

  it('reads the same measured backwards', () => {
    const next = extendTo(of('d'), 'b', ORDER);
    expect([...next.selected].sort()).toEqual(['b', 'c', 'd']);
  });

  it('adds a second run rather than replacing the first', () => {
    // Somebody picking a few groups out of eight hundred recordings expects both.
    const first = extendTo(of('a'), 'b', ORDER);
    const second = extendTo({ ...first, anchor: 'd' }, 'e', ORDER);
    expect([...second.selected].sort()).toEqual(['a', 'b', 'd', 'e']);
  });

  it('keeps the anchor where it was, so a second shift-click grows the same run', () => {
    const next = extendTo(of('b'), 'd', ORDER);
    expect(next.anchor).toBe('b');
    expect([...extendTo(next, 'c', ORDER).selected].sort()).toEqual(['b', 'c', 'd']);
  });

  it('is an ordinary click when there is no anchor to measure from', () => {
    // A range from nowhere has no meaning, and refusing to do anything reads as a broken checkbox.
    expect([...extendTo(EMPTY, 'c', ORDER).selected]).toEqual(['c']);
  });

  it('is an ordinary click when the anchor has left the list', () => {
    // An anchor can leave: a recording selected, then filtered out. The range cannot be measured,
    // so this behaves as a plain click -- which adds one and keeps whatever else was selected,
    // rather than throwing away a selection somebody built up.
    expect([...extendTo(of('zzz'), 'c', ORDER).selected].sort()).toEqual(['c', 'zzz']);
  });
});

describe('select all', () => {
  it('takes everything in view', () => {
    expect([...selectAll(EMPTY, ORDER, true).selected].sort()).toEqual(ORDER);
  });

  it('clears everything, including the anchor', () => {
    expect(selectAll(of('a', 'b'), ORDER, false)).toEqual(EMPTY);
  });
});

describe('coverage', () => {
  it('is false with nothing selected, mixed with some, true with all', () => {
    expect(coverage(EMPTY, ORDER)).toBe(false);
    expect(coverage(of('a'), ORDER)).toBe('mixed');
    expect(coverage(of(...ORDER), ORDER)).toBe(true);
  });

  it('is false for an empty list rather than trivially true', () => {
    // A header checkbox ticked over no rows is a control that claims to have done something.
    expect(coverage(EMPTY, [])).toBe(false);
  });
});

describe('after a partial failure', () => {
  it('keeps only what is named, which is what did not succeed', () => {
    // `UI-9c`: the failures stay selected so the retry is one click.
    const next = retain(of('a', 'b', 'c'), ['b']);
    expect([...next.selected]).toEqual(['b']);
  });

  it('drops an anchor that is no longer selected', () => {
    expect(retain(of('a', 'b'), ['a']).anchor).toBeNull();
  });
});
