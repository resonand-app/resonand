/**
 * Every number the interface shows, formatted once (`UI-22b`, §1.4).
 *
 * All of these are rendered in `--font-mono` with `tabular-nums`, which is what makes a column of
 * durations comparable at a glance. The rule the design system states and this file enforces is
 * that numbers are **formatted, not rounded away**: `149 h 44 min`, never `~150 h`; `537
 * recordings`, never `500+`. An archive is a claim about what is in it, and a rounded count is a
 * claim nobody can check.
 *
 * Durations are written out rather than handed to `Intl.DurationFormat`: `48:12` and `1:12:40`
 * are a fixed shape a person reads as a position in a recording, not a phrase.
 */

/**
 * A narrow no-break space (U+202F).
 *
 * Between a number and its unit, and between groups of digits, for two reasons. It never wraps,
 * so `149 h 44 min` cannot break across two lines and stop being one quantity; and it is the
 * separator §1.4 asks for, which is the same in every language the product will ever have --
 * unlike a comma, which means a decimal point to half of Europe.
 */
export const THIN = ' ';

/**
 * A position or a length, as `48:12` under an hour and `1:12:40` over it.
 *
 * Minutes are padded and hours are not, so the shape says which unit is leading without being
 * read. A null duration -- a recording still being processed -- is `--:--` rather than `0:00`,
 * because zero is a length and unknown is not.
 */
export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '--:--';
  const total = Math.round(ms / 1000);
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0
    ? `${String(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * A timestamp inside a transcript or a search result, which is a duration read as a place.
 *
 * The same shape as `duration`, and a separate name because it is a different thing: this one is
 * clickable and seeks (§1.4).
 */
export const timestamp = duration;

/**
 * How much is in a library or in the whole archive: `149 h 44 min`.
 *
 * Hours and minutes, never days, because "6 d 5 h" is a number nobody can compare to another
 * library's. Under a minute it says so rather than rounding to `0 h 0 min`.
 */
export function total(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return `0${THIN}min`;
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${count(rest)}${THIN}min`;
  return `${count(hours)}${THIN}h${THIN}${String(rest).padStart(2, '0')}${THIN}min`;
}

/**
 * A count, grouped and never rounded: `537`, `1 234`.
 *
 * Grouped with a thin space in every language rather than with the locale's own separator. That
 * is a deliberate exception to §1.6: a count sits next to a duration in the same mono column, and
 * `1,234` beside `1:12:40` reads as two kinds of punctuation doing one job.
 */
export function count(value: number): string {
  const digits = Math.trunc(Math.abs(value)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  return value < 0 ? `-${grouped}` : grouped;
}

/**
 * A file size from `size_bytes`: `284${THIN}MB`.
 *
 * Powers of 1024 with the units people see on their own filesystem, and one decimal only below
 * ten so that `1.4 GB` and `284 MB` are both honest without being long.
 */
export function bytes(size: number | null | undefined): string {
  if (size === null || size === undefined || !Number.isFinite(size) || size < 0) {
    return `0${THIN}B`;
  }
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rendered = unit === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1);
  return `${rendered}${THIN}${units[unit] ?? 'B'}`;
}

/** Playback speed, `0.75x` to `2.0x`, always with its decimal so the control does not jump. */
export function speed(rate: number): string {
  return `${rate.toFixed(2).replace(/0$/, '').replace(/\.$/, '.0')}x`;
}

/** How far through something is, as a whole number of percent. For progress, never for time. */
export function percent(fraction: number): string {
  return `${String(Math.round(Math.min(1, Math.max(0, fraction)) * 100))}%`;
}
