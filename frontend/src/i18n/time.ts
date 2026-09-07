/**
 * The two kinds of time, and the wall between them (`UI-22c`, §1.3, `DEC-11`).
 *
 * **A recording's own time is a wall-clock reading.** `recorded_at` plus `recorded_at_offset` is
 * what the clock on the wall said where the recording was made. A recording made at half six in
 * the evening was made at half six in the evening, permanently -- so it is rendered exactly as
 * written and **never converted to the viewer's timezone**. Someone opening a family archive from
 * another country must see the same evening the person who recorded it saw.
 *
 * **Everything else is an instant.** `created_at`, `deleted_at`, session and job times are UTC
 * moments and *are* rendered in the viewer's own timezone, relatively where that reads better.
 *
 * The wall between them is why there are two functions and no shared one: a single `formatDate`
 * would be given a `recorded_at` by somebody in a hurry, and the bug it produced -- an evening
 * that is a morning in Chile -- is invisible to whoever wrote it.
 *
 * `recorded_at_source` says where the date came from: a tag inside the file, a name like
 * `Recording 2024-03-11 18.22.m4a`, or the file's own mtime. It is rendered quietly, as a mono
 * label, because it is provenance and not a warning. A null `recorded_at` falls back to
 * `created_at` and **says plainly that the date shown is not the recording's own**, which in an
 * archive of old voice notes is an ordinary state rather than an edge case.
 */

/** What a recording carries about when it was made. The fields, not the recording. */
export interface RecordedTime {
  recorded_at: string | null;
  recorded_at_offset: number | null;
  recorded_at_source: string | null;
  created_at: string;
}

/** Where a date came from, weakest last. */
export type Provenance = 'container' | 'filename' | 'filesystem';

export interface RecordedDate {
  /** The date and time to show. */
  text: string;
  /** Whether this is the recording's own time, or the upload standing in for it. */
  isOwn: boolean;
  /** Where the recording's own time came from, when it has one. */
  provenance: Provenance | null;
  /** The offset as written, `+01:00`, when it is genuinely known. */
  offset: string | null;
}

/**
 * A recording's own time, rendered as written.
 *
 * The string is parsed by hand rather than by `Date`, which is the whole point: handing
 * `2026-03-12T18:22:00` to `new Date()` and formatting it produces the viewer's evening, not the
 * recording's. Nothing here constructs a `Date` at all, so there is no timezone to apply.
 */
export function recordedAt(recording: RecordedTime, locale?: string): RecordedDate {
  if (recording.recorded_at === null) {
    return {
      text: instant(recording.created_at, locale),
      isOwn: false,
      provenance: null,
      offset: null,
    };
  }
  return {
    text: wallClock(recording.recorded_at, locale),
    isOwn: true,
    provenance: provenanceOf(recording.recorded_at_source),
    offset: offsetOf(recording.recorded_at_offset),
  };
}

/**
 * A wall-clock reading, formatted in the viewer's language but not in their timezone.
 *
 * `Intl.DateTimeFormat` with `timeZone: 'UTC'` over the parts as written: the language decides
 * the order and the month's name, and the numbers are the ones in the string.
 */
export function wallClock(written: string, locale?: string): string {
  const parts = parse(written);
  if (parts === null) return written;
  const asWritten = new Date(Date.UTC(...parts));
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(asWritten);
}

/** A UTC instant, in the viewer's own timezone, because that is what it means to them. */
export function instant(iso: string, locale?: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(at);
}

/** The same instant, relatively, where "3 days ago" reads better than a date. */
export function relative(iso: string, locale?: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const seconds = (at.getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(Math.round(seconds), 'second');
}

/** How long is left of something, in whole days. What the trash counts down (§V9). */
export function daysLeft(deletedAt: string, retentionDays: number, now: Date = new Date()): number {
  const deleted = new Date(deletedAt);
  if (Number.isNaN(deleted.getTime())) return retentionDays;
  const elapsed = (now.getTime() - deleted.getTime()) / 86_400_000;
  return Math.max(0, Math.ceil(retentionDays - elapsed));
}

/** The offset as written, for the quiet label beside a time that has one. */
function offsetOf(minutes: number | null): string | null {
  if (minutes === null) return null;
  const sign = minutes < 0 ? '-' : '+';
  const size = Math.abs(minutes);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${sign}${pad(Math.floor(size / 60))}:${pad(size % 60)}`;
}

function provenanceOf(source: string | null): Provenance | null {
  return source === 'container' || source === 'filename' || source === 'filesystem' ? source : null;
}

/** The parts of a wall-clock string, or `null` when it is not one. */
function parse(written: string): [number, number, number, number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(written);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second ?? '0'),
  ];
}
