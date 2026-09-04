import React from "react";

export function Chip({ children, active, style, ...rest }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", height: 24, padding: "0 10px",
      borderRadius: "var(--radius-pill)",
      background: active ? "var(--accent-soft)" : "var(--surface-2)",
      color: active ? "var(--accent-on-soft)" : "var(--text-2)",
      fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size-sm)",
      transition: "background var(--transition-state)", ...style
    }} {...rest}>{children}</span>
  );
}
