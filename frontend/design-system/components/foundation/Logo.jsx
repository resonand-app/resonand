import React from "react";

/* The mark is the waveform reduced to four rounded strokes of unequal height — same geometry,
   same round cap, same rhythm as the Waveform component. */
export function Logo({ size = 21, showWordmark = true, color = "var(--accent)", style, ...rest }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 9, ...style }} {...rest}>
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none" style={{ display: "block", flex: "0 0 auto" }}>
        <g stroke={color} strokeWidth="2.6" strokeLinecap="round">
          <path d="M7 15.5v-5" /><path d="M11 19v-12" /><path d="M15 17v-8" /><path d="M19 14v-2" />
        </g>
      </svg>
      {showWordmark && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: "var(--weight-semibold)",
            fontSize: "var(--type-wordmark-size)",
            letterSpacing: "var(--type-wordmark-tracking)",
            color: "var(--text)"
          }}
        >
          Sonarium
        </span>
      )}
    </span>
  );
}
