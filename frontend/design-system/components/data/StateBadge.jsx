import React from "react";
import { Icon } from "../foundation/Icon.jsx";

const STATES = {
  none:    { label: "No transcript", icon: "circle-dashed", color: "var(--state-none)" },
  running: { label: "In progress",   icon: "loader",        color: "var(--state-running)" },
  done:    { label: "Done",          icon: "check",         color: "var(--state-done)" },
  failed:  { label: "Failed",        icon: "alert-circle",  color: "var(--state-failed)" }
};

export function StateBadge({ state = "none", variant = "chip", style, ...rest }) {
  const s = STATES[state] || STATES.none;
  if (variant === "glyph") {
    return <Icon name={s.icon} size={15} color={s.color} title={s.label} style={style} {...rest} />;
  }
  const bg =
    state === "done" ? "var(--state-done-bg)" :
    state === "failed" ? "var(--state-failed-bg)" : "var(--surface-2)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6, height: 24, padding: "0 10px",
      borderRadius: "var(--radius-pill)", background: bg, color: s.color,
      fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size-sm)", ...style
    }} {...rest}>
      <Icon name={s.icon} size={13} />
      {s.label}
    </span>
  );
}

export { STATES };
