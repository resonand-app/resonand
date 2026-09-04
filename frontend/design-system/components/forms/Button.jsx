import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const FILL = {
  primary: { background: "var(--accent)", color: "var(--accent-on)", boxShadow: "0 2px 8px rgba(232,180,92,.2)", fontWeight: 600 },
  secondary: { background: "var(--surface-2)", color: "var(--text-2)", fontWeight: 500 },
  ghost: { background: "transparent", color: "var(--text-2)", fontWeight: 500 },
  danger: { background: "var(--state-failed-bg)", color: "var(--state-failed-fg)", fontWeight: 500 }
};

export function Button({ variant = "primary", icon, children, disabled, focused, style, ...rest }) {
  return (
    <button
      type="button"
      disabled={disabled}
      style={{
        height: "var(--control-height)",
        padding: icon ? "0 15px 0 13px" : "0 15px",
        border: "none",
        borderRadius: "var(--radius-pill)",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--type-ui-size)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.38 : 1,
        transition: "background var(--transition-state), color var(--transition-state)",
        outline: focused ? "var(--focus-ring-width) solid var(--accent)" : "none",
        outlineOffset: "var(--focus-ring-offset)",
        ...FILL[variant],
        ...style
      }}
      {...rest}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
