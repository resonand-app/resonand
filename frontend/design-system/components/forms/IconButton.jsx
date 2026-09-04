import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function IconButton({ icon, variant = "filled", size = 32, label, active, style, ...rest }) {
  const fill =
    active ? { background: "var(--accent-soft)", color: "var(--accent-on-soft)" }
    : variant === "filled" ? { background: "var(--surface-2)", color: "var(--text-2)" }
    : { background: "transparent", color: "var(--text-3)" };
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: size,
        height: size,
        minWidth: size,
        border: "none",
        borderRadius: "var(--radius-circle)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        transition: "background var(--transition-state), color var(--transition-state)",
        ...fill,
        ...style
      }}
      {...rest}
    >
      <Icon name={icon} size={Math.round(size * 0.53)} />
    </button>
  );
}
