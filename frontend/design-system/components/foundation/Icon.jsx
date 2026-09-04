import React from "react";

/* Lucide, loaded from CDN. 1.5–1.7px stroke, round caps, 24px grid — the closest published
   match to the set drawn in the design exploration. See ICONOGRAPHY in readme.md. */
export function Icon({ name, size = 17, strokeWidth = 1.7, color = "currentColor", style, ...rest }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) window.lucide.createIcons({ nameAttr: "data-lucide", root: ref.current });
  }, [name, size, strokeWidth]);
  return (
    <span
      ref={ref}
      style={{ display: "grid", placeItems: "center", width: size, height: size, flex: "0 0 auto", color, ...style }}
      {...rest}
    >
      <i data-lucide={name} style={{ width: size, height: size, strokeWidth }}></i>
    </span>
  );
}
