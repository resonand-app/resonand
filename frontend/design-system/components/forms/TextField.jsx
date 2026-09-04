import React from "react";
import { Icon } from "../foundation/Icon.jsx";

export function TextField({ value, placeholder, label, error, focused, style, ...rest }) {
  const ring = error ? "0 0 0 1px #C4574A" : focused ? "0 0 0 2px var(--accent)" : "none";
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size-sm)", color: "var(--text-3)" }}>
          {label}
        </span>
      )}
      <span
        style={{
          height: "var(--field-height)",
          background: "var(--surface-2)",
          borderRadius: "var(--radius-control)",
          boxShadow: ring,
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 14px",
          transition: "box-shadow var(--transition-state)"
        }}
      >
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
        {error && <Icon name="alert-circle" size={15} color="var(--state-failed)" />}
      </span>
      {error && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--type-ui-size-sm)", color: "var(--state-failed)" }}>
          {error}
        </span>
      )}
    </label>
  );
}
