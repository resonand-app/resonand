import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, SVGAttributes } from 'react';

import { amplitudeAt, bucketCount, resamplePeaks } from './peaks';
import type { Peaks } from './peaks';
import { HEIGHT_TOKEN } from './wave-sizes';
import type { WaveSize } from './wave-sizes';

/**
 * The geometry, read from the stylesheet rather than re-derived here.
 *
 * Nine tokens describe this drawing and, before `UI-2b`, not one of them was read -- the bar
 * width was a chain of `height > 90 ? 4 : …` in JavaScript, the gap was `* 0.55` written out, and
 * the playhead was the literal `2`. The fallbacks below are the token values, and they are only
 * reached where custom properties cannot be resolved at all, which in practice means jsdom.
 */
interface Geometry {
  height: number;
  barWidth: number;
  gapRatio: number;
  playheadWidth: number;
}

const FALLBACK: Record<WaveSize, Geometry> = {
  dense: { height: 20, barWidth: 2, gapRatio: 0.55, playheadWidth: 2 },
  card: { height: 38, barWidth: 3, gapRatio: 0.55, playheadWidth: 2 },
  record: { height: 52, barWidth: 3, gapRatio: 0.55, playheadWidth: 2 },
  player: { height: 34, barWidth: 3, gapRatio: 0.55, playheadWidth: 2 },
  detail: { height: 130, barWidth: 3, gapRatio: 0.55, playheadWidth: 2 },
};

function readNumber(styles: CSSStyleDeclaration, token: string, fallback: number): number {
  const parsed = Number.parseFloat(styles.getPropertyValue(token));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readGeometry(element: Element, size: WaveSize): Geometry {
  const fallback = FALLBACK[size];
  const styles = getComputedStyle(element);
  return {
    height: readNumber(styles, HEIGHT_TOKEN[size], fallback.height),
    // The dense row is the one size with its own bar width: at 20px tall, 3px bars with a 1.65px
    // gap put fewer than thirty of them in an 88px column.
    barWidth: readNumber(
      styles,
      size === 'dense' ? '--wave-bar-width-dense' : '--wave-bar-width',
      fallback.barWidth,
    ),
    gapRatio: readNumber(styles, '--wave-bar-gap-ratio', fallback.gapRatio),
    playheadWidth: readNumber(styles, '--wave-playhead-width', fallback.playheadWidth),
  };
}

export interface WaveformProps extends Omit<SVGAttributes<SVGSVGElement>, 'onSeek'> {
  /** Stored peaks: interleaved min/max, one pair per bucket, each -1…1. */
  peaks?: Peaks | undefined;
  /** Which of the five drawings this is. Decides the height and the bar width, both from tokens. */
  size?: WaveSize;
  /** Played fraction, 0-1. Played bars take `--wave`, the rest `--wave-dim`. */
  played?: number;
  /** Draws the playhead. On in the player and on audio detail. */
  playhead?: boolean;
  /** The peaks job has not run: renders a dashed rule and the duration, never a fake shape. */
  pending?: boolean;
  /** Shown beside the dashed rule when `pending`. The formatted duration, mono and tabular. */
  duration?: string | undefined;
  /**
   * What the pending drawing says when there is no duration to show either (`UI-24c`).
   *
   * English by default so the standalone kit renders, and always passed by the application: this
   * string reached three card surfaces untranslated because the fallback looked like a detail.
   */
  noWaveformLabel?: string | undefined;
  /** Click and arrow keys seek. Only the detail view passes this. */
  onSeek?: ((fraction: number) => void) | undefined;
  /** Names the control when it can be seeked. */
  label?: string | undefined;
  /** Wrapper style. The rest of the props go to the `<svg>`. */
  style?: CSSProperties | undefined;
}

const DASH: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  width: '100%',
};

/**
 * The signature element: amplitude sampled into rounded bars.
 *
 * Peaks are computed once on ingest and stored, so a recording draws the same shape in a dense
 * row, on a card and in the detail view. **Until that job has run there is no waveform** --
 * `pending` draws a dashed rule and the duration, and ignores `peaks` entirely, because an
 * invented shape is a picture of a recording nobody has listened to (`UI-2d`).
 *
 * **It resamples rather than truncates (`UI-2a`).** The stored array is reduced to the number of
 * bars that fit, by the same arithmetic the server uses, so the shape survives the reduction.
 * Before this it was `peaks.slice(0, count)`: the first N buckets, which for a 48-minute interview
 * in a 20px row was the first forty seconds of it.
 *
 * **Every number in the drawing comes from a token (`UI-2b`).** Height, bar width, gap ratio and
 * playhead width are read from the stylesheet, so changing `--wave-bar-width` changes the picture
 * rather than disagreeing with it.
 */
export function Waveform({
  peaks,
  size = 'card',
  played = 0,
  playhead = false,
  pending = false,
  duration,
  noWaveformLabel,
  onSeek,
  label,
  style,
  ...rest
}: WaveformProps) {
  /* `useId` and not `Math.random()`: a random value read during render is unstable across a
     re-render, and for a clip path that means the played half silently stops being clipped.
     Sanitised because `url(#…)` has to survive as a fragment reference. */
  const clipId = `wave-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [geometry, setGeometry] = useState<Geometry>(() => FALLBACK[size]);

  /* Bar count follows the rendered width, so an 88px row and a 1000px detail view get the same
     bar pitch rather than the same bar count squeezed to fit. The geometry is re-read alongside
     it: a token can change under hot reload, and a resize is the cheapest moment to notice. */
  useEffect(() => {
    const element = host.current;
    if (element === null) return;
    const measure = () => {
      setWidth(element.clientWidth);
      setGeometry(readGeometry(element, size));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [size]);

  const { height, barWidth, gapRatio, playheadWidth } = geometry;

  if (pending) {
    /* `peaks`, `played` and `playhead` are all ignored here, on purpose. A recording whose peaks
       job has not run cannot be made to draw a waveform by passing one. */
    return (
      <div ref={host} style={{ ...DASH, height, ...style }}>
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 100 ${String(height)}`}
          preserveAspectRatio="none"
          aria-hidden
          style={{ display: 'block', flex: 1, minWidth: 0 }}
          {...rest}
        >
          <line
            x1="0"
            y1={height / 2}
            x2="100"
            y2={height / 2}
            stroke="var(--wave-dim)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="2 5"
          />
        </svg>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--type-numeric-size)',
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text-3)',
            flex: '0 0 auto',
          }}
        >
          {duration ?? noWaveformLabel ?? 'No waveform yet'}
        </span>
      </div>
    );
  }

  const gap = barWidth * gapRatio;
  const pitch = barWidth + gap;
  const wanted = Math.max(6, Math.floor((width || 700) / pitch));
  const data = resamplePeaks(peaks ?? [], wanted);
  const cols = Math.max(1, bucketCount(data));
  const mid = height / 2;
  const amp = mid * 0.92;
  const viewWidth = cols * pitch - gap;

  const bars = (fill: string) =>
    Array.from({ length: cols }, (_, i) => {
      /* The floor is the bar width, so a silent passage stays a row of dots rather than
         disappearing into the midline (`UI-2c`). */
      const barHeight = Math.max(barWidth, amplitudeAt(data, i) * amp * 2);
      return (
        <rect
          key={i}
          x={+(i * pitch).toFixed(2)}
          y={+(mid - barHeight / 2).toFixed(2)}
          width={barWidth}
          height={+barHeight.toFixed(2)}
          rx={barWidth / 2}
          fill={fill}
        />
      );
    });

  const seekTo = (event: MouseEvent<HTMLDivElement>) => {
    if (onSeek === undefined) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    onSeek(Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)));
  };

  const seekByKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (onSeek === undefined) return;
    const step =
      event.key === 'ArrowLeft' ? -0.01 : event.key === 'ArrowRight' ? 0.01 : undefined;
    if (step !== undefined) {
      event.preventDefault();
      onSeek(Math.min(1, Math.max(0, played + step)));
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      onSeek(event.key === 'Home' ? 0 : 1);
    }
  };

  const seekable = onSeek !== undefined;

  return (
    <div
      ref={host}
      onClick={seekable ? seekTo : undefined}
      onKeyDown={seekable ? seekByKey : undefined}
      role={seekable ? 'slider' : undefined}
      tabIndex={seekable ? 0 : undefined}
      aria-label={seekable ? (label ?? 'Seek') : undefined}
      aria-valuemin={seekable ? 0 : undefined}
      aria-valuemax={seekable ? 100 : undefined}
      aria-valuenow={seekable ? Math.round(played * 100) : undefined}
      data-ds="waveform"
      data-seekable={seekable ? 'true' : undefined}
      style={{ width: '100%', ...style }}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${String(viewWidth)} ${String(height)}`}
        style={{ display: 'block', overflow: 'visible' }}
        {...rest}
      >
        <g>{bars('var(--wave-dim)')}</g>
        {played > 0 && (
          <>
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={viewWidth * played} height={height} />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>{bars('var(--wave)')}</g>
            {playhead && (
              <rect
                x={viewWidth * played - playheadWidth / 2}
                y="0"
                width={playheadWidth}
                height={height}
                rx={playheadWidth / 2}
                fill="var(--wave)"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}
