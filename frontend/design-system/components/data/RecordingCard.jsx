import React from "react";
import { IconButton } from "../forms/IconButton.jsx";
import { StateBadge } from "./StateBadge.jsx";
import { Chip } from "./Chip.jsx";
import { Waveform } from "../media/Waveform.jsx";

export function RecordingCard({
  name, meta, state = "done", tags = [], peaks, seed = 21, played = 0,
  pending = false, onPlay, style, ...rest
}) {
  return (
    <article style={{
      background: "var(--surface)", borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-card)",
      padding: "14px var(--panel-padding)", display: "flex", flexDirection: "column", gap: 10, ...style
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{
            fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: "15px",
            letterSpacing: "-0.005em", color: "var(--text)"
          }}>{name}</span>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: "var(--type-numeric-size)",
            fontVariantNumeric: "tabular-nums", color: "var(--text-3)"
          }}>{meta}</span>
        </div>
        <IconButton icon="play" size={32} label={"Play " + name} onClick={onPlay}
          style={{ background: "var(--accent-soft)", color: "var(--accent-on-soft)" }} />
      </div>
      <Waveform peaks={peaks} seed={seed} height={52} played={played} playhead={played > 0} pending={pending} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <StateBadge state={state} />
        {tags.map(t => <Chip key={t}>{t}</Chip>)}
      </div>
    </article>
  );
}
