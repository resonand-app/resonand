import React from "react";
import { StateBadge } from "./StateBadge.jsx";
import { Waveform } from "../media/Waveform.jsx";

export function RecordingRow({
  name, duration, state = "done", peaks, seed = 41, played = 0,
  pending = false, selected = false, onOpen, style, ...rest
}) {
  return (
    <div onClick={onOpen} style={{
      height: "var(--row-height)", display: "flex", alignItems: "center", gap: 11, padding: "0 12px",
      background: selected ? "var(--surface-2)" : "transparent",
      cursor: onOpen ? "pointer" : "default",
      transition: "background var(--transition-state)", ...style
    }} {...rest}>
      <StateBadge state={state} variant="glyph" />
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size)", color: "var(--text)",
        flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
      }}>{name}</span>
      <div style={{ width: 88, flex: "0 0 auto" }}>
        <Waveform peaks={peaks} seed={seed} height={20} played={played} pending={pending} barWidth={2} />
      </div>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: "var(--type-numeric-size)", fontVariantNumeric: "tabular-nums",
        color: "var(--text-3)", width: 46, textAlign: "right", flex: "0 0 auto"
      }}>{duration}</span>
    </div>
  );
}
