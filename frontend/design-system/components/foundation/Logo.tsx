import type { HTMLAttributes } from 'react';

export interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  /** Mark size in px. 21 in the nav, 26-28 at rest, 40+ on the login screen. */
  size?: number;
  /** Set false for the mark alone (favicon, collapsed nav, avatar tile). */
  showWordmark?: boolean;
  /** Stroke colour of the mark. Defaults to the accent. */
  color?: string;
}

/**
 * The Sonarium lockup: the four-stroke mark, optionally with the Chillax wordmark beside it.
 *
 * The mark is the waveform reduced to four rounded strokes of unequal height -- same geometry,
 * same round cap, same rhythm as the `Waveform` component, so the logo and the data read as the
 * same object. Use it in the top nav, on the sign-in screen, and nowhere else. Chillax appears
 * here and in the single page title per screen; there is no third case.
 */
export function Logo({
  size = 21,
  showWordmark = true,
  color = 'var(--accent)',
  style,
  ...rest
}: LogoProps) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 9, ...style }} {...rest}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 26 26"
        fill="none"
        aria-hidden
        focusable="false"
        style={{ display: 'block', flex: '0 0 auto' }}
      >
        <g stroke={color} strokeWidth="2.6" strokeLinecap="round">
          <path d="M7 15.5v-5" />
          <path d="M11 19v-12" />
          <path d="M15 17v-8" />
          <path d="M19 14v-2" />
        </g>
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--type-wordmark-size)',
            letterSpacing: 'var(--type-wordmark-tracking)',
            color: 'var(--text)',
          }}
        >
          Sonarium
        </span>
      )}
    </span>
  );
}
