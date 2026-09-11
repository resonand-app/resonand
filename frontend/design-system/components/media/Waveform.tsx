import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, SVGAttributes } from 'react';

import { predicted } from './follow';
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

/** What does not vary with the size, so the table below is only what does. */
const SHARED = { gapRatio: 0.55, playheadWidth: 2 };

const FALLBACK: Record<WaveSize, Geometry> = {
  dense: { ...SHARED, height: 20, barWidth: 2 },
  card: { ...SHARED, height: 38, barWidth: 3 },
  record: { ...SHARED, height: 52, barWidth: 3 },
  player: { ...SHARED, height: 34, barWidth: 3 },
  detail: { ...SHARED, height: 130, barWidth: 3 },
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
  /**
   * How much of the recording a second of playback covers, or 0 when it is not playing.
   *
   * What makes `played` an anchor rather than an instruction: given this, the drawing works out
   * where the position is on every frame instead of waiting to be told four times a second. A
   * seek is a new anchor, so it still lands where it was asked for, immediately.
   */
  advance?: number;
  /**
   * When `played` was true, on `performance.now()`'s clock. Defaults to when it arrived here.
   *
   * The difference is the milliseconds between the element being read and this being drawn, and
   * carrying the position forward from the wrong end of that gap steps the playhead backwards on
   * every report -- the one movement nobody misses.
   */
  playedAt?: number | undefined;
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
  advance = 0,
  playedAt,
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
  const gap = barWidth * gapRatio;
  const pitch = barWidth + gap;
  const wanted = Math.max(6, Math.floor((width || 700) / pitch));
  const data = useMemo(() => resamplePeaks(peaks ?? [], wanted), [peaks, wanted]);
  const cols = Math.max(1, bucketCount(data));
  const mid = height / 2;
  const viewWidth = cols * pitch - gap;

  /* Held across renders because the position is reported four times a second and the bars do not
     change when it does: at the detail size that is six hundred elements rebuilt to move a line. */
  const bars = useMemo(() => {
    const amp = mid * 0.92;
    const draw = (fill: string) =>
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
    return { dim: draw('var(--wave-dim)'), played: draw('var(--wave)') };
  }, [data, cols, barWidth, pitch, mid]);

  /* The two parts that move, written straight to the DOM: they are a transform each, and going
     through React to set them would re-render the bars sixty times a second to no effect. */
  const clip = useRef<SVGRectElement>(null);
  const head = useRef<SVGRectElement>(null);
  const furthest = useRef(0);
  const reported = useRef(played);
  useEffect(() => {
    /* A report only ever moves forward while something plays, so a report behind the one before
       it is a seek, and the drawing follows it back. A report behind the drawing is not: it is
       noise in when the element was read -- `currentTime` is quantised to the audio callback,
       which pairs a position with a moment a few milliseconds after it was true -- and drawing
       it would flinch the playhead backwards, which is the one movement nobody misses. */
    if (played < reported.current) furthest.current = played;
    reported.current = played;
    const paint = (fraction: number) => {
      const at = Math.max(fraction, furthest.current);
      furthest.current = at;
      if (clip.current !== null) clip.current.style.transform = `scaleX(${String(at)})`;
      if (head.current !== null) {
        head.current.style.transform = `translateX(${String(at * viewWidth)}px)`;
      }
    };
    paint(played);
    if (advance <= 0) return;
    const anchored = playedAt !== undefined && playedAt > 0 ? playedAt : performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      paint(predicted(played, (now - anchored) / 1000, advance));
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [played, playedAt, advance, viewWidth]);

  /* Peaks that hold no buckets are the same fact as no peaks job having run, and drawing them
     would stretch a single bar the width of the surface. */
  if (pending || bucketCount(peaks ?? []) === 0) {
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
        <g>{bars.dim}</g>
        {(played > 0 || advance > 0) && (
          <>
            <defs>
              <clipPath id={clipId}>
                {/* Scaled rather than resized: a transform is the one geometry a browser moves
                    without laying the drawing out again. */}
                <rect
                  ref={clip}
                  x="0"
                  y="0"
                  width={viewWidth}
                  height={height}
                  style={{ transform: `scaleX(${String(played)})`, transformOrigin: '0 0' }}
                />
              </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>{bars.played}</g>
            {playhead && (
              <rect
                ref={head}
                x={-playheadWidth / 2}
                y="0"
                width={playheadWidth}
                height={height}
                rx={playheadWidth / 2}
                fill="var(--wave)"
                style={{ transform: `translateX(${String(+(viewWidth * played).toFixed(2))}px)` }}
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}
