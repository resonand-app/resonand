import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties, SVGAttributes } from 'react';

import { generatePeaks } from './generate-peaks';

export interface WaveformProps extends SVGAttributes<SVGSVGElement> {
  /** Stored peaks, 0-1, computed once on ingest. Always pass these in production.
   *  Explicitly `| undefined`: a caller forwarding a recording that has none should not have to
   *  choose between passing the prop and not passing it. */
  peaks?: number[] | undefined;
  /** Mock seed, used only when `peaks` is absent. Specimens and prototypes only. */
  seed?: number;
  /** 20 dense row - 38 library card - 52 recording card - 34 player - 130 audio detail. */
  height?: number;
  /** Played fraction, 0-1. Played bars take `--wave`, the rest `--wave-dim`. */
  played?: number;
  /** Draws the 2px rounded playhead. On in the player and on audio detail. */
  playhead?: boolean;
  /** Override bar width. Defaults by height; 2px under 26px tall. */
  barWidth?: number;
  /** The peaks job has not run: renders a dashed rule, never a fake shape. */
  pending?: boolean;
  /** Wrapper style. The rest of the props go to the `<svg>`. */
  style?: CSSProperties;
}

/**
 * The signature element: amplitude sampled into rounded bars.
 *
 * Peaks are computed once on ingest and stored, so a recording draws the same shape in a dense
 * row, on a card and in the detail view. **When the peaks job has not run there is no waveform** --
 * `pending` draws a dashed rule and the duration owns the space, because an invented shape is a
 * picture of a recording nobody has listened to.
 *
 * **Two known defects are ported unchanged, because they are `UI-2a`.** `peaks.slice(0, count)`
 * truncates rather than resamples, so a stored array longer than the bar count shows only the
 * beginning of the recording -- which contradicts the promise in the paragraph above. And
 * `preserveAspectRatio="none"` stretches the bars, so the rounded caps the whole treatment rests
 * on are not round. Fixing either here would hide a redesign inside a transcription.
 */
export function Waveform({
  peaks,
  seed = 7,
  height = 38,
  played = 0,
  playhead = false,
  barWidth,
  pending = false,
  style,
  ...rest
}: WaveformProps) {
  /* `useId` and not `Math.random()`. That swap is one of the three things `UI-2a` was to do,
     pulled forward because the React Compiler's purity rule refuses to let the original land at
     all -- and it is right to: a random value read during render is unstable across a re-render,
     which for a clip path means the played half of the waveform silently stops being clipped.
     `UI-2a` still owns the two that matter, the resampling and `preserveAspectRatio`.
     The id is sanitised because `url(#...)` has to survive being a fragment reference. */
  const clipId = `wave-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const host = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  /* Bar count follows the rendered width, so an 88px row and a 1000px detail view get the same
     bar pitch rather than the same bar count squeezed to fit. */
  useEffect(() => {
    if (host.current === null) return;
    const measure = () => {
      setWidth(host.current?.clientWidth ?? 0);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(host.current);
    return () => {
      observer.disconnect();
    };
  }, []);

  const bw = barWidth ?? (height > 90 ? 4 : height > 26 ? 3 : 2);
  const gap = bw * 0.55;
  const pitch = bw + gap;
  const count = Math.max(6, Math.floor((width || 700) / pitch));
  const data = peaks !== undefined && peaks.length > 0 ? peaks.slice(0, count) : generatePeaks(seed, count);
  const cols = data.length;
  const mid = height / 2;
  const amp = mid * 0.92;
  const viewWidth = cols * pitch - gap;
  const viewBox = `0 0 ${String(viewWidth)} ${String(height)}`;

  if (pending) {
    return (
      <div ref={host} style={{ width: '100%', ...style }}>
        <svg
          width="100%"
          height={height}
          viewBox={viewBox}
          preserveAspectRatio="none"
          style={{ display: 'block' }}
          {...rest}
        >
          <line
            x1="0"
            y1={mid}
            x2={viewWidth}
            y2={mid}
            stroke="var(--wave-dim)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="2 5"
          />
        </svg>
      </div>
    );
  }

  const bars = (fill: string) =>
    data.map((peak, i) => {
      const h = Math.max(bw, peak * amp * 2);
      return (
        <rect
          key={i}
          x={+(i * pitch).toFixed(2)}
          y={+(mid - h / 2).toFixed(2)}
          width={bw}
          height={+h.toFixed(2)}
          rx={bw / 2}
          fill={fill}
        />
      );
    });

  return (
    <div ref={host} style={{ width: '100%', ...style }}>
      <svg
        width="100%"
        height={height}
        viewBox={viewBox}
        preserveAspectRatio="none"
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
                x={viewWidth * played - 1}
                y="0"
                width="2"
                height={height}
                rx="1"
                fill="var(--wave)"
              />
            )}
          </>
        )}
      </svg>
    </div>
  );
}
