import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function Dialog({ title, description, width = 420, onClose, footer, children, style, ...rest }) {
  return (
    <div style={{
      width, background: "var(--surface)", borderRadius: "var(--radius-panel)",
      boxShadow: "var(--elevation-overlay)", padding: "var(--space-6)",
      display: "flex", flexDirection: "column", gap: "var(--space-4)", ...style
    }} role="dialog" aria-label={title} {...rest}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <h2 style={{
            margin: 0, fontFamily: "var(--font-sans)", fontWeight: "var(--type-title-weight)",
            fontSize: "var(--type-title-size)", letterSpacing: "var(--type-title-tracking)", color: "var(--text)"
          }}>{title}</h2>
          {description && (
            <p style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "13px", lineHeight: 1.55, color: "var(--text-3)", textWrap: "pretty" }}>
              {description}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{
          width: 28, height: 28, border: "none", background: "transparent", color: "var(--text-3)",
          borderRadius: "var(--radius-circle)", display: "grid", placeItems: "center", cursor: "pointer", flex: "0 0 auto"
        }}>
          <Icon name="x" size={17} />
        </button>
      </div>
      {children}
      {footer && <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>{footer}</div>}
    </div>
  );
}
