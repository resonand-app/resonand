import React from "react";

const LIBRARY_COLORS = [
  { name: "amber", value: "var(--library-amber)" },
  { name: "clay", value: "var(--library-clay)" },
  { name: "slate", value: "var(--library-slate)" },
  { name: "moss", value: "var(--library-moss)" },
  { name: "stone", value: "var(--library-stone)" },
  { name: "plum", value: "var(--library-plum)" },
  { name: "teal", value: "var(--library-teal)" }
];

export function ColorSwatchPicker({ value = "clay", onChange, size = 22, label = "Colour", style, ...rest }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, ...style }} {...rest}>
      {label && (
        <span style={{ fontFamily: "var(--font-sans)", fontSize: "12.5px", color: "var(--text-3)" }}>{label}</span>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        {LIBRARY_COLORS.map(c => (
          <button
            key={c.name}
            type="button"
            aria-label={c.name}
            aria-pressed={value === c.name}
            onClick={() => onChange && onChange(c.name)}
            style={{
              width: size,
              height: size,
              border: "none",
              borderRadius: "var(--radius-circle)",
              background: c.value,
              cursor: "pointer",
              boxShadow: value === c.name ? "0 0 0 2px var(--bg), 0 0 0 4px var(--accent)" : "none",
              transition: "box-shadow var(--transition-state)"
            }}
          />
        ))}
      </div>
    </div>
  );
}

export { LIBRARY_COLORS };
