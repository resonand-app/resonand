import type { HTMLAttributes } from 'react';

/** The `viewBox` below is the path's own ink box, so the mark's width follows its height. */
const MARK_ASPECT = 375.5 / 423.5;

export interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  /** Height of the mark in px. 18 in the nav, 22 at rest, 34 on the sign-in screen. */
  size?: number;
  /** Set false for the mark alone (favicon, collapsed nav, avatar tile). */
  showWordmark?: boolean;
  /** Stroke colour of the mark. Defaults to the accent. */
  color?: string;
  /** Accessible name of the lockup. Nothing reads it when the wordmark is off. */
  label?: string;
}

/**
 * The Resonand lockup: the mark standing in for the S, with `onarium` set beside it.
 *
 * The mark itself lives in `design-system/assets/resonand-mark*.svg` as fixed-color SVGs for
 * contexts without CSS (the favicon, the guideline swatches); this is the same geometry, colored
 * through the `color` prop instead, for the one context that has CSS. Use it in the top nav, on
 * the sign-in screen, and nowhere else. Chillax appears here and in the single page title per
 * screen; there is no third case.
 *
 * The brand kit draws the lockup as one object, so `size` sets both halves of it and neither is a
 * prop: the wordmark is `--type-wordmark-scale` of the mark's height, sits `--type-wordmark-lead`
 * after it, and shares its baseline. A caller that could set them separately could draw a lockup
 * the kit does not contain.
 *
 * The word on screen is six letters, so the name is given rather than read off it. Without that
 * the nav announces "onarium".
 */
export function Logo({
  size = 18,
  showWordmark = true,
  color = 'var(--accent)',
  label = 'Resonand',
  style,
  ...rest
}: LogoProps) {
  return (
    <span
      {...(showWordmark ? { role: 'img', 'aria-label': label } : {})}
      style={{ display: 'flex', alignItems: 'baseline', ...style }}
      {...rest}
    >
      <svg
        width={size * MARK_ASPECT}
        height={size}
        viewBox="68.25 41.75 375.50 423.50"
        fill="none"
        aria-hidden
        focusable="false"
        style={{ display: 'block', flex: '0 0 auto' }}
      >
        <path
          d="M256.69 42.12c-3.35 0.31-6.36 0.75-9.12 1.33-2.24 0.46-5.33 1.07-7.46 1.49-11.65 2.21-34.4 10.41-48.6 17.51-34.08 17.04-65.46 44.85-88.2 78.18-3.26 4.78-8.69 13.08-10.74 16.43-14.01 22.93-24.19 51.09-24.19 66.95 0 10.95 4.62 17.14 11.73 15.68 4.61-0.94 8.06-4.96 9.98-11.61 6.45-22.56 26.83-55.21 49.68-79.62 6.68-7.14 12.55-12.93 19.09-18.85 0.98-0.88 2.02-1.8 2.33-2.06 0.3-0.25 1.53-1.31 2.73-2.34 1.94-1.68 2.81-2.4 5.66-4.75 27.11-22.36 57.83-37.52 85.83-42.38 2.08-0.36 3.66-0.7 4.69-1.01 1.12-0.34 5.21-1.15 7.88-1.55 14.51-2.19 21.34-15.05 14-26.39-3.59-5.54-12.9-8.12-25.25-6.99zM256.56 117.34c-41.49 1.76-91.8 37.51-114.33 81.23-5.48 10.64-8.53 20.09-9.93 30.69-0.11 0.86-0.28 2.1-0.38 2.75-0.38 2.59-0.44 3.41-0.44 5.94 0 8.01 1.33 11.89 5.03 14.76 2.96 2.3 7.44 2.24 10.59-0.14 1.58-1.2 2.76-3.35 3.64-6.6 0.76-2.8 1.41-4.95 2.06-6.78 0.33-0.9 0.66-1.88 0.78-2.19 2.66-7.81 8.62-19.05 14.91-28.12 17.96-25.94 46.18-48.48 75.31-60.16 4.78-1.91 9.26-3.46 17.88-6.2 7.79-2.46 9.71-3.4 12.25-5.95 2.98-2.96 3.85-5.71 3.26-10.19-0.61-4.64-4.19-7.9-9.43-8.62-2.99-0.4-7.48-0.58-11.21-0.41zM263.16 176.64c-1.8 0.34-3.89 1.05-6.41 2.21-1.2 0.55-2.86 1.29-3.69 1.65-27.95 12.16-59.09 45.94-67.38 73.1-0.24 0.8-0.66 2.05-0.94 2.78-6.58 17.59-1.21 33.4 14.43 42.56 8.96 5.25 21.55 7.79 34.08 6.88 4.4-0.31 6.41-0.65 10.06-1.66 1.69-0.46 2.43-0.64 3.31-0.78 1.68-0.26 4.53-0.93 7.31-1.7 5.25-1.46 5.06-1.41 9.56-2.79 1.34-0.41 2.64-0.8 2.88-0.86 0.24-0.08 1.18-0.35 2.06-0.62 0.9-0.28 2.27-0.68 3.06-0.9 0.79-0.23 2.74-0.8 4.31-1.28 1.59-0.48 3.35-1 3.94-1.18 0.59-0.18 2.05-0.62 3.25-1 5.33-1.69 6.1-1.93 6.78-2.04 0.7-0.12 2.4-0.68 10.79-3.51 39.04-13.16 72.33-12.59 89.5 1.56 16.28 13.41 14.55 37.36-4.54 62.74-16.68 22.18-45.84 44-72.09 53.95-1.85 0.71-5.76 2.24-8.68 3.4-6.35 2.53-7.38 2.88-11.45 3.91-6.99 1.79-15.26 3.34-22.56 4.24-3.46 0.43-3.99 0.48-5.19 0.58-0.69 0.05-1.9 0.15-2.69 0.24-8.9 0.84-25.48 0.99-30.56 0.28-0.48-0.08-1.24-0.12-1.69-0.14-3.39-0.01-15.54-2.08-21.03-3.55-1.39-0.39-3.24-0.84-4.1-1-0.86-0.16-2.1-0.4-2.75-0.54-7.59-1.46-15.2 2.41-18.74 9.53-4.4 8.86 0.29 20.58 10.43 26.09 7.76 4.23 18.48 8.53 25.88 10.39 0.14 0.03 0.7 0.19 1.25 0.34 0.55 0.15 1.65 0.44 2.44 0.65 0.79 0.2 1.98 0.51 2.62 0.68 6.6 1.74 10.56 2.56 16.62 3.41 34.54 4.9 78.94-5.71 115.62-27.65 73.5-43.94 105.81-118.62 71.06-164.28-11.73-15.41-31.93-27.25-54.06-31.69-0.31-0.06-1.29-0.28-2.19-0.49-5.28-1.23-10.74-1.83-17.69-1.96-7.08-0.14-12 0.18-21.25 1.38-1.34 0.18-2.91 0.39-3.5 0.45-2.58 0.33-11.41 2.04-17.56 3.43-14.83 3.33-23.91 5.8-34.31 9.35-1.83 0.62-4.08 1.35-5 1.62-10.84 3.14-20.23 6.58-29.16 10.68-2.53 1.16-9.29 4.04-10.96 4.67-0.86 0.33-2.12 0.83-2.81 1.1-3.62 1.48-6.43 0.96-9.12-1.66-3.89-3.79-1.93-11.99 5.2-21.76 0.89-1.23 2.26-2.85 5.38-6.35 2.39-2.7 15.44-15.14 19.85-18.94 0.59-0.5 2.23-1.98 3.64-3.25 1.41-1.29 3.44-3.12 4.5-4.08 2.34-2.09 11.62-11.41 13-13.04 10.65-12.68 4.16-27.9-10.71-25.14z"
          fill={color}
        />
      </svg>
      {showWordmark && (
        <span
          aria-hidden
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--weight-semibold)',
            fontSize: `calc(var(--type-wordmark-scale) * ${String(size)}px)`,
            marginLeft: 'var(--type-wordmark-lead)',
            // The mark sets the lockup's height; leading below the baseline would only pad it.
            lineHeight: 'var(--type-wordmark-leading)',
            color: 'var(--text)',
          }}
        >
          onarium
        </span>
      )}
    </span>
  );
}
