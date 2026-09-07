/**
 * Each format, exactly as §1.4 writes it (`UI-22b`).
 *
 * Written from the specification's table rather than from the implementation, so a change to the
 * shape of a duration is a decision somebody takes rather than a diff that goes unnoticed.
 */

import { describe, expect, it } from 'vitest';

import { THIN, bytes, count, duration, percent, speed, timestamp, total } from './format';

describe('a duration', () => {
  it('is mm:ss under an hour', () => {
    expect(duration(48 * 60_000 + 12_000)).toBe('48:12');
    expect(duration(108_000)).toBe('01:48');
  });

  it('is h:mm:ss over an hour, with the hour unpadded', () => {
    expect(duration(3600_000 + 12 * 60_000 + 40_000)).toBe('1:12:40');
    expect(duration(10 * 3600_000)).toBe('10:00:00');
  });

  it('says unknown rather than zero, because zero is a length', () => {
    expect(duration(null)).toBe('--:--');
    expect(duration(undefined)).toBe('--:--');
  });

  it('is the same shape as a transcript timestamp, which is the same thing read as a place', () => {
    expect(timestamp(18 * 60_000 + 4_000)).toBe('18:04');
  });
});

describe('a total', () => {
  it('is hours and minutes', () => {
    expect(total((149 * 60 + 44) * 60_000)).toBe(`149${THIN}h${THIN}44${THIN}min`);
  });

  it('pads the minutes so a column of them lines up', () => {
    expect(total((2 * 60 + 4) * 60_000)).toBe(`2${THIN}h${THIN}04${THIN}min`);
  });

  it('drops the hours rather than showing zero of them', () => {
    expect(total(31 * 60_000)).toBe(`31${THIN}min`);
    expect(total(0)).toBe(`0${THIN}min`);
  });

  it('never wraps between a number and its unit', () => {
    expect(total(3600_000)).not.toContain(' ');
  });
});

describe('a count', () => {
  it('is never rounded away', () => {
    expect(count(537)).toBe('537');
    expect(count(1234)).toBe(`1${THIN}234`);
    expect(count(1234567)).toBe(`1${THIN}234${THIN}567`);
  });

  it('groups with a thin space rather than with a comma', () => {
    // A comma is a decimal point to half of Europe, and this number sits in the same mono column
    // as a duration.
    expect(count(1234)).not.toContain(',');
  });
});

describe('a file size', () => {
  it('comes from size_bytes and reads like the filesystem', () => {
    expect(bytes(284 * 1024 * 1024)).toBe(`284${THIN}MB`);
    expect(bytes(1536)).toBe(`1.5${THIN}kB`);
    expect(bytes(900)).toBe(`900${THIN}B`);
  });

  it('keeps one decimal only where it says something', () => {
    expect(bytes(1.4 * 1024 * 1024 * 1024)).toBe(`1.4${THIN}GB`);
    expect(bytes(42 * 1024 * 1024 * 1024)).toBe(`42${THIN}GB`);
  });
});

describe('playback speed', () => {
  it('always carries its decimal, so the control does not change width', () => {
    expect(speed(1)).toBe('1.0x');
    expect(speed(2)).toBe('2.0x');
    expect(speed(0.75)).toBe('0.75x');
    expect(speed(1.5)).toBe('1.5x');
  });
});

describe('a proportion', () => {
  it('is a whole percent, and never a time', () => {
    expect(percent(0.336)).toBe('34%');
    expect(percent(0)).toBe('0%');
    expect(percent(2)).toBe('100%');
  });
});
