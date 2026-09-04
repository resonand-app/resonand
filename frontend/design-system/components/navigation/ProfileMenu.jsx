import React from "react";
import { Icon } from "../foundation/Icon.jsx";

function Row({ icon, label, value, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 34, width: "100%", border: "none", background: "transparent", color: "var(--text-2)",
      borderRadius: "var(--radius-control)", display: "flex", alignItems: "center", gap: 10,
      padding: "0 10px", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size)",
      transition: "background var(--transition-state)"
    }}>
      <Icon name={icon} size={17} color="var(--text-3)" />
      <span style={{ flex: 1, textAlign: "left" }}>{label}</span>
      {value && <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "11px", color: "var(--text-3)" }}>{value}</span>}
    </button>
  );
}

export function ProfileMenu({
  name = "Martí Colom", email = "marti@sonarium.app", initials = "MC",
  theme = "Dark", onTheme, onSettings, onSignOut, style, ...rest
}) {
  return (
    <div role="menu" style={{
      width: 236, background: "var(--surface)", borderRadius: "var(--radius-panel)",
      boxShadow: "var(--elevation-overlay)", padding: 8, display: "flex", flexDirection: "column", gap: 2, ...style
    }} {...rest}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 10px" }}>
        <span style={{
          width: 32, height: 32, borderRadius: "var(--radius-circle)", background: "var(--accent-soft)",
          color: "var(--accent-on-soft)", display: "grid", placeItems: "center",
          fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "12px", flex: "0 0 auto"
        }}>{initials}</span>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "13.5px", fontWeight: 600, color: "var(--text)" }}>{name}</span>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: "11.5px", color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
        </div>
      </div>
      <div style={{ height: 1, background: "var(--hairline)", margin: "2px 0 4px" }} />
      <Row icon="moon" label="Theme" value={theme} onClick={onTheme} />
      <Row icon="sliders-horizontal" label="Settings" onClick={onSettings} />
      <Row icon="log-out" label="Sign out" onClick={onSignOut} />
    </div>
  );
}
