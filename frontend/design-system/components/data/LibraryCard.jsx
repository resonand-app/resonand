import React from "react";
import { IconButton } from "../forms/IconButton.jsx";
import { Waveform } from "../media/Waveform.jsx";

export function LibraryCard({
  name, meta, colour = "var(--library-clay)", peaks, seed = 3, played = 0,
  pending = false, onOpen, style, ...rest
}) {
  return (
    <article onClick={onOpen} style={{
      width: "100%", height: "var(--card-height)", background: "var(--surface)",
      borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-card)",
      padding: "var(--panel-padding)", display: "flex", flexDirection: "column",
      cursor: onOpen ? "pointer" : "default", transition: "box-shadow var(--transition-state)", ...style
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <span style={{ width: 26, height: 26, borderRadius: "var(--radius-chip)", flex: "0 0 auto", background: colour }} />
        <IconButton icon="more-vertical" variant="ghost" size={26} label={"Options for " + name} />
      </div>
      <h3 style={{
        margin: "11px 0 0", fontFamily: "var(--font-sans)", fontWeight: "var(--type-title-weight)",
        fontSize: "var(--type-title-size)", lineHeight: "var(--type-title-leading)",
        letterSpacing: "var(--type-title-tracking)", color: "var(--text)", textWrap: "pretty"
      }}>{name}</h3>
      <span style={{
        marginTop: 4, fontFamily: "var(--font-mono)", fontSize: "var(--type-numeric-size)",
        fontVariantNumeric: "tabular-nums", color: "var(--text-3)"
      }}>{meta}</span>
      <div style={{ marginTop: "auto" }}>
        <Waveform peaks={peaks} seed={seed} height={38} played={played} pending={pending} />
      </div>
    </article>
  );
}
