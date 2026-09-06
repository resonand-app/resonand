import * as React from "react";

/**
 * The glyph names this system registers.
 *
 * Not every Lucide name -- the registry in `Icon.jsx` is what keeps the other fourteen hundred
 * icons out of the bundle, and this union is that registry stated for the type checker. Adding a
 * glyph is two lines there and one here.
 */
export type IconName =
  | "align-left"
  | "alert-circle"
  | "check"
  | "chevron-left"
  | "circle-dashed"
  | "clock"
  | "library"
  | "loader"
  | "log-out"
  | "moon"
  | "more-vertical"
  | "panel-left"
  | "pause"
  | "play"
  | "plus"
  | "search"
  | "share-2"
  | "skip-back"
  | "skip-forward"
  | "sliders-horizontal"
  | "tag"
  | "trash-2"
  | "upload"
  | "x";

/**
 * A single Lucide glyph at the system's stroke weight.
 * @startingPoint section="Foundation" subtitle="Lucide glyphs at Sonarium stroke weight" viewport="700x150"
 */
export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** A registered glyph name, kebab-case, e.g. "search", "upload", "panel-left". */
  name: IconName;
  /** Rendered box in px. 17 in rows and buttons, 15 for state glyphs, 21 in the nav. */
  size?: number;
  /** Stroke weight. Leave at 1.7 unless the glyph sits under 15px. */
  strokeWidth?: number;
  /** Defaults to currentColor so the parent controls it. */
  color?: string;
}

export declare function Icon(props: IconProps): React.JSX.Element;
