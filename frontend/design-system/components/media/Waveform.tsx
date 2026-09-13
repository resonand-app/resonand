import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, SVGAttributes } from 'react';

import { held, predicted } from './follow';
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

/**
 * Keep the moves coming after the pointer leaves the drawing.
 *
 * Guarded because capture is a convenience and not the seek: a pointer the browser no longer
 * considers down throws rather than returning, and jsdom has no capture at all. Without it a
 * drag simply stops updating at the edge, which is worse than a seek that fails.
 */
function capture(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // The drag goes on without it.
  }
}

export interface WaveformProps extends Omit<SVGAttributes<SVGSVGElement>, 'onSeek'> {
  /** Stored peaks: interleaved min/max, one pair per bucket, each -1…1. */
  peaks?: Peaks | undefined;
  /** Which of the five drawings this is. Decides the height and the bar width, both from tokens. */
  size?: WaveSize;
  /** Played fraction, 0-1. Played bars take `--wave`, the rest `--wave-dim`. */
  played?: number;
  /**
   * Draw the whole shape in `--wave` rather than `--wave-dim`, and do nothing else.
   *
   * How a surface says "this is the one playing" without drawing a second playhead (`UI-6c`):
   * the picture is lit, not filled. A card uses it because the player at the foot of the shell
   * is where playback has a position, and two things drawing that position is what makes people
   * believe there are two players.
   */
  lit?: boolean;
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
  /**
   * Where the seek landed, 0-1. A click, a drag released, or an arrow key.
   *
   * Passing it is what turns the drawing into a control: without it the waveform is a picture,
   * and a picture that took a pointer would be a control nobody could reach from a keyboard.
   */
  onSeek?: ((fraction: number) => void) | undefined;
  /**
   * Where a drag is, while it is still a drag, and `null` when it ends.
   *
   * The drawing already follows the pointer on its own -- this is for the surfaces that show the
   * position as a number beside it. A playhead under the pointer next to a readout frozen where
   * the sound is reads as two positions, and the point of the drag is to see where you are going
   * before you commit to it.
   */
  onPreview?: ((fraction: number | null) => void) | undefined;
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
  lit = false,
  playhead = false,
  advance = 0,
  playedAt,
  pending = false,
  duration,
  noWaveformLabel,
  onSeek,
  onPreview,
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
  /** Where a drag has the position, 0-1, or `null` when nothing is being dragged. */
  const [scrub, setScrub] = useState<number | null>(null);

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
    return { dim: draw('var(--wave-dim)'), wave: draw('var(--wave)') };
  }, [data, cols, barWidth, pitch, mid]);

  /* The two parts that move, written straight to the DOM: they are a transform each, and going
     through React to set them would re-render the bars sixty times a second to no effect. */
  const drawing = useRef<SVGSVGElement>(null);
  const clip = useRef<SVGRectElement>(null);
  const head = useRef<SVGRectElement>(null);
  /** Where the drawing actually is, which is not `played` on any frame between two reports. */
  const drawn = useRef(played);
  useEffect(() => {
    const draw = (fraction: number) => {
      drawn.current = fraction;
      if (clip.current !== null) clip.current.style.transform = `scaleX(${String(fraction)})`;
      if (head.current !== null) {
        head.current.style.transform = `translateX(${String(fraction * viewWidth)}px)`;
      }
    };

    /* A drag is where the position is going, and nothing else gets a say while it lasts: the
       playhead belongs under the pointer, and a prediction carrying on underneath would drag it
       away from the finger holding it. */
    if (scrub !== null) {
      draw(scrub);
      return;
    }

    // `held` is the whole rule about reports that land behind the drawing, and it is bounded.
    const from = held(drawn.current, played, advance);
    draw(from);
    if (advance <= 0) return;
    const anchored = playedAt !== undefined && playedAt > 0 ? playedAt : performance.now();
    let frame = requestAnimationFrame(function step(now: number) {
      // Never behind where this report started drawing, so a frame cannot undo the hold -- and
      // never held beyond it, because the floor is recomputed from the next report.
      draw(Math.max(from, predicted(played, (now - anchored) / 1000, advance)));
      frame = requestAnimationFrame(step);
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [played, playedAt, advance, viewWidth, scrub]);

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
            stroke={lit ? 'var(--wave)' : 'var(--wave-dim)'}
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

  /**
   * Where along the drawing a pointer is, 0-1.
   *
   * Measured against the drawing and not against the box around it, because those are not the
   * same width. The playhead moves in the `viewBox`'s units, and the `viewBox` is exactly as wide
   * as the bars it holds -- which is narrower than the surface whenever the recording has fewer
   * buckets than there is room for bars, since peaks are never interpolated up. Measuring the
   * surface put the pointer and the playhead in two different coordinate systems: three pixels
   * apart in the detail view, and two hundred and thirty-nine in the bar.
   */
  const fractionAt = (event: PointerEvent<HTMLDivElement>): number | null => {
    if (drawing.current === null) return null;
    const box = drawing.current.getBoundingClientRect();
    // `meet` fits the drawing inside the element and never magnifies it here, because the element
    // is given the viewBox's own height -- so the drawn width is the smaller of the two.
    const drawn = Math.min(viewWidth, box.width);
    if (drawn === 0) return null;
    return Math.min(1, Math.max(0, (event.clientX - box.left) / drawn));
  };

  /* Press, drag, release -- rather than a click, which is only delivered when the button comes
     back up. A waveform that took clicks alone gave nothing back for as long as the button was
     held, so the drag people were already making looked like a control that had stopped
     responding. Pressing is what starts it, because a seek is over the moment it is released and
     there is nothing to cancel by dragging away. */
  const startScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (onSeek === undefined || event.button !== 0) return;
    const at = fractionAt(event);
    if (at === null) return;
    // The drag keeps receiving moves after it leaves the drawing, which is what makes the ends
    // reachable: a pointer that has to stay inside a 34px bar is a pointer that cannot reach 0.
    capture(event.currentTarget, event.pointerId);
    setScrub(at);
    onPreview?.(at);
  };

  const moveScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (scrub === null) return;
    const at = fractionAt(event);
    if (at === null) return;
    setScrub(at);
    onPreview?.(at);
  };

  const endScrub = (event: PointerEvent<HTMLDivElement>) => {
    if (onSeek === undefined || scrub === null) return;
    const at = fractionAt(event) ?? scrub;
    setScrub(null);
    onPreview?.(null);
    onSeek(at);
  };

  /** A drag the system took away -- a call arriving, the tab going. It asked for no seek. */
  const cancelScrub = () => {
    if (scrub === null) return;
    setScrub(null);
    onPreview?.(null);
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
      onPointerDown={seekable ? startScrub : undefined}
      onPointerMove={seekable ? moveScrub : undefined}
      onPointerUp={seekable ? endScrub : undefined}
      onPointerCancel={seekable ? cancelScrub : undefined}
      onKeyDown={seekable ? seekByKey : undefined}
      role={seekable ? 'slider' : undefined}
      tabIndex={seekable ? 0 : undefined}
      aria-label={seekable ? (label ?? 'Seek') : undefined}
      aria-valuemin={seekable ? 0 : undefined}
      aria-valuemax={seekable ? 100 : undefined}
      // What a drag is asking for, while it is asking: a slider that announced the sound's
      // position during a drag would tell a screen reader the opposite of what it is doing.
      aria-valuenow={seekable ? Math.round((scrub ?? played) * 100) : undefined}
      data-ds="waveform"
      data-seekable={seekable ? 'true' : undefined}
      data-scrubbing={scrub === null ? undefined : 'true'}
      style={{ width: '100%', ...style }}
    >
      <svg
        ref={drawing}
        width="100%"
        height={height}
        viewBox={`0 0 ${String(viewWidth)} ${String(height)}`}
        /* Anchored left rather than centred, which is what the default does. A drawing narrower
           than its element was being centred, so its left edge -- position zero -- sat half the
           difference in from the edge a pointer is measured from. Stated here rather than left to
           a default, because the seek arithmetic above depends on which edge it is. */
        preserveAspectRatio="xMinYMid meet"
        style={{ display: 'block', overflow: 'visible' }}
        {...rest}
      >
        <g>{lit ? bars.wave : bars.dim}</g>
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
            <g clipPath={`url(#${clipId})`}>{bars.wave}</g>
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
