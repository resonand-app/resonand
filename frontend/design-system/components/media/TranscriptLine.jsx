import React from "react";

export function TranscriptLine({ at, children, active, onClick, style, ...rest }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", gap: 12, padding: "7px 9px", borderRadius: 9,
      background: active ? "var(--accent-soft)" : "transparent",
      cursor: onClick ? "pointer" : "default",
      transition: "background var(--transition-state)", ...style
    }} {...rest}>
      <span style={{
        fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "11.5px", fontVariantNumeric: "tabular-nums",
        color: active ? "var(--accent-on-soft)" : "var(--text-3)", flex: "0 0 auto", paddingTop: 2
      }}>{at}</span>
      <span style={{
        fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.55,
        color: active ? "var(--text)" : "var(--text-2)", textWrap: "pretty"
      }}>{children}</span>
    </div>
  );
}
