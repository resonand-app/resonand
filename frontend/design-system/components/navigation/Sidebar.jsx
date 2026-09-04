import React from "react";
import { Icon } from "../foundation/Icon.jsx";

function Item({ icon, dot, label, count, active, collapsed, onClick }) {
  return (
    <button type="button" onClick={onClick} title={collapsed ? label : undefined} style={{
      height: 32, width: "100%", border: "none", background: active ? "var(--accent-soft)" : "transparent",
      color: active ? "var(--accent-on-soft)" : "var(--text-2)",
      borderRadius: "var(--radius-control)", display: "flex", alignItems: "center",
      justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: collapsed ? 0 : "0 11px",
      cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size)",
      transition: "background var(--transition-state), color var(--transition-state)"
    }}>
      {icon && <Icon name={icon} size={17} />}
      {dot && <span style={{ width: 9, height: 9, borderRadius: "var(--radius-circle)", flex: "0 0 auto", background: dot }} />}
      {!collapsed && (
        <React.Fragment>
          <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: active ? 600 : 400 }}>{label}</span>
          {count != null && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", fontVariantNumeric: "tabular-nums", color: "var(--text-3)" }}>{count}</span>
          )}
        </React.Fragment>
      )}
    </button>
  );
}

function GroupLabel({ children }) {
  return (
    <div style={{
      padding: "16px 11px 6px", fontFamily: "var(--font-mono)", fontSize: "var(--type-overline-size)",
      fontWeight: "var(--type-overline-weight)", letterSpacing: "var(--type-overline-tracking)",
      textTransform: "uppercase", color: "var(--text-3)"
    }}>{children}</div>
  );
}

export function Sidebar({ own = [], shared = [], trashCount, collapsed = false, activeId = "libraries", onSelect, style, ...rest }) {
  const pick = id => () => onSelect && onSelect(id);
  return (
    <nav style={{
      width: collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width)",
      flex: "0 0 auto", background: "var(--surface)", borderRadius: "var(--radius-panel)",
      boxShadow: "var(--elevation-panel)", display: "flex", flexDirection: "column",
      padding: collapsed ? "12px 9px" : "12px 10px", gap: collapsed ? 6 : 0,
      transition: "width var(--transition-panel)", ...style
    }} {...rest}>
      <Item icon="library" label="Libraries" active={activeId === "libraries"} collapsed={collapsed} onClick={pick("libraries")} />
      {collapsed ? (
        <Item icon="search" label="Search" collapsed onClick={pick("search")} />
      ) : (
        <React.Fragment>
          <GroupLabel>Your libraries</GroupLabel>
          {own.map(l => (
            <Item key={l.id || l.name} dot={l.colour} label={l.name} count={l.count}
              active={activeId === (l.id || l.name)} onClick={pick(l.id || l.name)} />
          ))}
          {shared.length > 0 && <GroupLabel>Shared with you</GroupLabel>}
          {shared.map(l => (
            <Item key={l.id || l.name} dot={l.colour} label={l.name} count={l.count}
              active={activeId === (l.id || l.name)} onClick={pick(l.id || l.name)} />
          ))}
        </React.Fragment>
      )}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: collapsed ? 6 : 0 }}>
        <Item icon="trash-2" label="Trash" count={collapsed ? null : trashCount} collapsed={collapsed}
          active={activeId === "trash"} onClick={pick("trash")} />
        <Item icon="sliders-horizontal" label="Settings" collapsed={collapsed}
          active={activeId === "settings"} onClick={pick("settings")} />
      </div>
    </nav>
  );
}
