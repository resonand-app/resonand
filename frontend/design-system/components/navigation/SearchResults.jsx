import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function SearchResults({ hits = [], total, query = "", onOpen, onSeeAll, style, ...rest }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: "var(--radius-panel)", boxShadow: "var(--elevation-overlay)",
      padding: 8, display: "flex", flexDirection: "column", gap: 2, ...style
    }} {...rest}>
      {hits.map((h, i) => (
        <button type="button" key={i} onClick={() => onOpen && onOpen(h)} style={{
          border: "none", background: "transparent", borderRadius: "var(--radius-control)",
          display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 10px", cursor: "pointer",
          fontFamily: "var(--font-sans)", textAlign: "left", transition: "background var(--transition-state)"
        }}>
          <Icon name={h.kind === "library" ? "library" : "align-left"} size={15} color="var(--text-3)" style={{ marginTop: 2 }} />
          <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: "var(--type-ui-size)", color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.title}</span>
            <span style={{ fontSize: "11.5px", lineHeight: 1.45, color: "var(--text-3)" }}>{h.excerpt}</span>
          </span>
          {h.at && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-3)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{h.at}</span>
          )}
        </button>
      ))}
      <div style={{ height: 1, background: "var(--hairline)", margin: "4px 0" }} />
      <button type="button" onClick={onSeeAll} style={{
        border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px 4px", cursor: "pointer", fontFamily: "var(--font-sans)"
      }}>
        <span style={{ fontSize: "12.5px", color: "var(--text-3)", flex: 1, textAlign: "left" }}>
          All {total} results for “{query}”
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "10.5px", color: "var(--text-3)",
          background: "var(--surface-2)", borderRadius: 5, padding: "2px 6px"
        }}>↵</span>
      </button>
    </div>
  );
}
