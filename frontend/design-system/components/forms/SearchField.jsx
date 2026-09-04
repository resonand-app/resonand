import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function SearchField({ value, placeholder = "Search everything you've recorded", shortcut = "⌘K", focused, style, ...rest }) {
  return (
    <div
      style={{
        height: "var(--field-height)",
        background: "var(--surface-2)",
        borderRadius: "var(--radius-pill)",
        boxShadow: focused ? "0 0 0 2px var(--accent)" : "none",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        transition: "box-shadow var(--transition-state)",
        ...style
      }}
    >
      <Icon name="search" size={17} color={focused ? "var(--accent)" : "var(--text-3)"} />
      <input
        defaultValue={value}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-sans)",
          fontSize: "13.5px",
          color: "var(--text)"
        }}
        {...rest}
      />
      {shortcut && (
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: "10.5px", color: "var(--text-3)" }}>
          {shortcut}
        </span>
      )}
    </div>
  );
}
