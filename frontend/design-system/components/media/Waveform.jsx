import React from "react";

/* Deterministic peak generation. In production, peaks are computed once on ingest and stored, so the
   same recording always draws the same shape at every size — pass them in via the peaks prop.
   The seed prop is for mocks and specimens only. */
function prng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function generatePeaks(seed, count) {
  const r = prng(seed);
  const out = [];
  let envelope = 0.55;
  for (let i = 0; i < count; i++) {
    envelope += (r() - 0.5) * 0.42;
    envelope = Math.max(0.1, Math.min(1, envelope));
    let a = envelope * (0.4 + 0.6 * r());
    if (r() < 0.07) a *= 0.16;
    out.push(a);
  }
  return out;
}

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
}) {
  const clipId = React.useMemo(() => "wave-" + Math.random().toString(36).slice(2, 9), []);
  const host = React.useRef(null);
  const [width, setWidth] = React.useState(0);

  /* Bar count follows the rendered width, so a 88px row and a 1000px detail view get the same bar
     pitch rather than the same bar count squeezed to fit. */
  React.useEffect(() => {
    if (!host.current) return;
    const measure = () => setWidth(host.current ? host.current.clientWidth : 0);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(host.current);
    return () => ro.disconnect();
  }, []);

  const bw = barWidth || (height > 90 ? 4 : height > 44 ? 3 : height > 26 ? 3 : 2);
  const gap = bw * 0.55;
  const pitch = bw + gap;
  const count = Math.max(6, Math.floor((width || 700) / pitch));
  const data = peaks && peaks.length ? peaks.slice(0, count) : generatePeaks(seed, count);
  const cols = data.length;
  const mid = height / 2;
  const amp = mid * 0.92;
  const viewWidth = cols * pitch - gap;
  const viewBox = "0 0 " + viewWidth + " " + height;

  if (pending) {
    return (
      <div ref={host} style={{ width: "100%", ...style }}>
        <svg width="100%" height={height} viewBox={viewBox} preserveAspectRatio="none"
          style={{ display: "block" }} {...rest}>
          <line x1="0" y1={mid} x2={viewWidth} y2={mid}
            stroke="var(--wave-dim)" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 5" />
        </svg>
      </div>
    );
  }

  const bars = fill =>
    data.map((p, i) => {
      const h = Math.max(bw, p * amp * 2);
      return (
        <rect key={i} x={+(i * pitch).toFixed(2)} y={+(mid - h / 2).toFixed(2)}
          width={bw} height={+h.toFixed(2)} rx={bw / 2} fill={fill} />
      );
    });

  return (
    <div ref={host} style={{ width: "100%", ...style }}>
      <svg width="100%" height={height} viewBox={viewBox} preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }} {...rest}>
        <g>{bars("var(--wave-dim)")}</g>
        {played > 0 && (
          <React.Fragment>
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={viewWidth * played} height={height} />
              </clipPath>
            </defs>
            <g clipPath={"url(#" + clipId + ")"}>{bars("var(--wave)")}</g>
            {playhead && <rect x={viewWidth * played - 1} y="0" width="2" height={height} rx="1" fill="var(--wave)" />}
          </React.Fragment>
        )}
      </svg>
    </div>
  );
}
