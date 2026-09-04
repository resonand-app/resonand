import React from "react";
import { IconButton } from "../forms/IconButton.jsx";
import { Waveform } from "./Waveform.jsx";

export function PlayerBar({
  title = "The house on Carrer Nou",
  library = "Àvia Teresa",
  peaks,
  seed = 11,
  position = "18:04",
  duration = "48:12",
  played = 0.375,
  playing = true,
  speed = "1.0×",
  onToggle,
  style,
  ...rest
}) {
  const mono = { fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "11.5px", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{
      height: "var(--player-height)", background: "var(--surface)", borderRadius: "var(--radius-panel)",
      boxShadow: "var(--elevation-panel)", display: "flex", alignItems: "center", gap: 16, padding: "0 16px", ...style
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-2)" }}>
        <IconButton icon="skip-back" variant="ghost" size={30} label="Back 15 seconds" style={{ color: "var(--text-2)" }} />
        <IconButton icon={playing ? "pause" : "play"} size={38} label={playing ? "Pause" : "Play"} onClick={onToggle}
          style={{ background: "var(--accent)", color: "var(--accent-on)" }} />
        <IconButton icon="skip-forward" variant="ghost" size={30} label="Forward 15 seconds" style={{ color: "var(--text-2)" }} />
      </div>
      <div style={{ width: 250, flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size)", fontWeight: 600,
          color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</span>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "11.5px", color: "var(--text-3)" }}>{library}</span>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span style={{ ...mono, color: "var(--accent)" }}>{position}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Waveform peaks={peaks} seed={seed} height={34} played={played} playhead />
        </div>
        <span style={{ ...mono, color: "var(--text-3)" }}>{duration}</span>
      </div>
      <span style={{ ...mono, color: "var(--text-2)", background: "var(--surface-2)",
        borderRadius: "var(--radius-pill)", padding: "6px 12px" }}>{speed}</span>
    </div>
  );
}
