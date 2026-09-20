/**
 * A recording made in another timezone reads the same everywhere (`UI-22c`, §1.3).
 *
 * The test that matters is the first one, and it is written the only way it can be: by running
 * the same recording through the formatter under several timezones and asserting the answer does
 * not move. Every other way of testing this passes on the machine that wrote it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { daysLeft, instant, recordedAt, relative, wallClock } from '../time';

/** A recording made at half six on a March evening, with the offset genuinely known. */
const FIELD_TAKE = {
  recorded_at: '2026-03-12T18:22:00',
  recorded_at_offset: 60,
  recorded_at_source: 'container',
  recorded_at_precision: 'second',
  created_at: '2026-03-12T09:14:00Z',
};

/** A voice note from `PTT-20260312-WA0007.opus`: the name gave a day and no hour. */
const VOICE_NOTE = {
  recorded_at: '2026-03-12T00:00:00',
  recorded_at_offset: null,
  recorded_at_source: 'filename',
  recorded_at_precision: 'date',
  created_at: '2026-03-12T09:14:00Z',
};

/** A digitised cassette: nobody knows when it was recorded, only when it arrived. */
const CASSETTE = {
  recorded_at: null,
  recorded_at_offset: null,
  recorded_at_source: null,
  recorded_at_precision: null,
  created_at: '2026-03-12T09:14:00Z',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a recording's own time", () => {
  it('is the same evening in every timezone a viewer might be in', () => {
    // Half six in the evening, permanently. Converted, this would be a morning in Santiago and
    // the next day in Auckland -- and the person who recorded it would not recognise either.
    const rendered = new Set<string>();
    for (const zone of ['Europe/Madrid', 'America/Santiago', 'Pacific/Auckland', 'UTC']) {
      vi.stubEnv('TZ', zone);
      rendered.add(recordedAt(FIELD_TAKE, 'en-GB').text);
    }
    expect(rendered.size).toBe(1);
    expect([...rendered][0]).toContain('18:22');
  });

  it('is rendered in the viewer language, in the recording numbers', () => {
    expect(wallClock('2026-03-12T18:22:00', 'en-GB')).toContain('12 Mar 2026');
    expect(wallClock('2026-03-12T18:22:00', 'ca-ES')).toContain('2026');
  });

  it('carries where the date came from, which is provenance and not a warning', () => {
    expect(recordedAt(FIELD_TAKE).provenance).toBe('container');
    expect(recordedAt({ ...FIELD_TAKE, recorded_at_source: 'filesystem' }).provenance).toBe(
      'filesystem',
    );
    expect(recordedAt({ ...FIELD_TAKE, recorded_at_source: 'invented' }).provenance).toBeNull();
  });

  it('carries the offset as written, when it is genuinely known', () => {
    expect(recordedAt(FIELD_TAKE).offset).toBe('+01:00');
    expect(recordedAt({ ...FIELD_TAKE, recorded_at_offset: -330 }).offset).toBe('-05:30');
    expect(recordedAt({ ...FIELD_TAKE, recorded_at_offset: null }).offset).toBeNull();
  });

  it('shows a day and no hour when a day is all the source stated', () => {
    // The whole point of the field: 00:00:00 is padding in a fixed-width column, and rendering
    // it states a midnight that the filename this recording came from never claimed.
    const shown = recordedAt(VOICE_NOTE, 'en-GB');
    expect(shown.text).toContain('12 Mar 2026');
    expect(shown.text).not.toContain('00:00');
    expect(shown.isOwn).toBe(true);
  });

  it('shows an unknown precision in full, because unknown is not date-only', () => {
    // What every recording ingested before the column existed carries. Hiding the time here
    // would withdraw a real one from every row a container tag populated.
    const shown = recordedAt({ ...FIELD_TAKE, recorded_at_precision: null }, 'en-GB');
    expect(shown.text).toContain('18:22');
  });

  it('falls back to the upload and says so, rather than inventing one', () => {
    const shown = recordedAt(CASSETTE, 'en-GB');
    expect(shown.isOwn).toBe(false);
    expect(shown.provenance).toBeNull();
  });
});

describe('every other time', () => {
  it('is an instant, and does move with the viewer', () => {
    // The opposite of the rule above, and the reason there are two functions: an upload happened
    // at a moment, and the moment is what it means to whoever is reading it.
    vi.stubEnv('TZ', 'UTC');
    const utc = instant('2026-03-12T23:30:00Z', 'en-GB');
    vi.stubEnv('TZ', 'Pacific/Auckland');
    const auckland = instant('2026-03-12T23:30:00Z', 'en-GB');
    expect(utc).not.toBe(auckland);
  });

  it('reads relatively where that is what somebody means', () => {
    const now = new Date('2026-03-12T12:00:00Z');
    expect(relative('2026-03-09T12:00:00Z', 'en-GB', now)).toBe('3 days ago');
    expect(relative('2026-03-12T11:30:00Z', 'en-GB', now)).toBe('30 minutes ago');
  });

  it('counts what the trash has left in whole days', () => {
    const now = new Date('2026-03-12T12:00:00Z');
    expect(daysLeft('2026-03-10T12:00:00Z', 30, now)).toBe(28);
    expect(daysLeft('2026-01-01T12:00:00Z', 30, now)).toBe(0);
  });
});

describe('a value that is not a time', () => {
  it('is shown as it arrived rather than as "Invalid Date"', () => {
    expect(instant('not a date')).toBe('not a date');
    expect(wallClock('not a date')).toBe('not a date');
  });
});
