import React from "react";
import { Logo } from "../foundation/Logo.jsx";
import { IconButton } from "../forms/IconButton.jsx";
import { Button } from "../forms/Button.jsx";
import { SearchField } from "../forms/SearchField.jsx";

export function TopNav({
  initials = "MC", query, searchFocused, onToggleSidebar, onUpload, onProfile, children, style, ...rest
}) {
  return (
    <header style={{
      height: "var(--nav-height)", background: "var(--surface)", borderRadius: "var(--radius-panel)",
      boxShadow: "var(--elevation-panel)", display: "flex", alignItems: "center", gap: 14,
      padding: "0 14px", position: "relative", ...style
    }} {...rest}>
      <IconButton icon="panel-left" label="Toggle sidebar" onClick={onToggleSidebar} style={{ borderRadius: "var(--radius-control)" }} />
      <Logo size={21} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", position: "relative" }}>
        <div style={{ width: "100%", maxWidth: 540, position: "relative" }}>
          <SearchField value={query} focused={searchFocused} />
          {children}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Button variant="primary" icon="upload" onClick={onUpload}>Upload audio</Button>
        <button type="button" onClick={onProfile} aria-label="Account" style={{
          width: 32, height: 32, border: "none", borderRadius: "var(--radius-circle)",
          background: "var(--accent-soft)", color: "var(--accent-on-soft)", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "11.5px"
        }}>{initials}</button>
      </div>
    </header>
  );
}
