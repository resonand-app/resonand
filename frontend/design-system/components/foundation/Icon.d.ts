import * as React from "react";

/**
 * A single Lucide glyph at the system's stroke weight.
 * @startingPoint section="Foundation" subtitle="Lucide glyphs at Sonarium stroke weight" viewport="700x150"
 */
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Lucide icon name, kebab-case, e.g. "search", "upload", "panel-left". */
  name: string;
  /** Rendered box in px. 17 in rows and buttons, 15 for state glyphs, 21 in the nav. */
  size?: number;
  /** Stroke weight. Leave at 1.7 unless the glyph sits under 15px. */
  strokeWidth?: number;
  /** Defaults to currentColor so the parent controls it. */
  color?: string;
}

export declare function Icon(props: IconProps): React.JSX.Element;
