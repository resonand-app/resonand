import {
  Check,
  ChevronLeft,
  CircleAlert,
  CircleDashed,
  Clock,
  EllipsisVertical,
  Library,
  Loader,
  LogOut,
  Moon,
  PanelLeft,
  Pause,
  Play,
  Plus,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Tag,
  TextAlignStart,
  Trash,
  Upload,
  X
} from "lucide-react";

/* One Lucide glyph at the system's stroke weight (`UI-1b`).
 *
 * The `name` string API is the point of this component: a screen says `<Icon name="search" />`
 * and never imports a glyph, so this is the one file that changes if a real icon set ever
 * arrives. What changed underneath it is where the glyph comes from -- `lucide-react`, bundled
 * and tree-shaken, instead of a UMD build fetched from unpkg and a `createIcons` effect that
 * rewrote the DOM after every render.
 *
 * The registry is written out rather than derived from the name, which costs a line per glyph
 * and buys two things. It is what makes the import tree-shakeable: `lucide-react`'s entry point
 * exports some fourteen hundred icons, and a lookup like `icons[name]` keeps a reference to all
 * of them -- measured at 759 KB minified against 2.6 KB for three named imports, which is four
 * times the whole application bundle for a set of glyphs nothing asks for. And it absorbs
 * upstream's renames -- four of the names this system documents are deprecated
 * aliases in Lucide 1.x, so `align-left` is `TextAlignStart` here, `alert-circle` is
 * `CircleAlert`, `more-vertical` is `EllipsisVertical` and `trash-2` is `Trash`. The system's
 * vocabulary is unchanged and the day the aliases are dropped is a four-line diff in this file.
 *
 * These are the glyphs the README documents plus the ones components ask for by computed name
 * (`StateBadge`'s four states, `SearchResults`' two kinds of hit). Adding one is adding two
 * lines here; forgetting to is a thrown error rather than an empty box. */
const GLYPHS = {
  "align-left": TextAlignStart,
  "alert-circle": CircleAlert,
  "check": Check,
  "chevron-left": ChevronLeft,
  "circle-dashed": CircleDashed,
  "clock": Clock,
  "library": Library,
  "loader": Loader,
  "log-out": LogOut,
  "moon": Moon,
  "more-vertical": EllipsisVertical,
  "panel-left": PanelLeft,
  "pause": Pause,
  "play": Play,
  "plus": Plus,
  "search": Search,
  "share-2": Share2,
  "skip-back": SkipBack,
  "skip-forward": SkipForward,
  "sliders-horizontal": SlidersHorizontal,
  "tag": Tag,
  "trash-2": Trash,
  "upload": Upload,
  "x": X
};

export function Icon({ name, size = 17, strokeWidth = 1.7, color = "currentColor", style, ...rest }) {
  const Glyph = GLYPHS[name];

  /* Loudly in development, quietly in production. An unknown name used to render an empty
     `<i>` that looked like a spacing bug and got debugged as one; now it stops the person who
     typed it. In a build it is a missing glyph and never a blank screen -- the box keeps its
     size, so the row it sits in does not reflow in front of somebody using the product. */
  if (!Glyph) {
    if (import.meta.env.DEV) {
      throw new Error(
        `Icon: no glyph named "${name}". Add it to GLYPHS in components/foundation/Icon.jsx.`
      );
    }
    console.error(`Icon: no glyph named "${name}".`);
  }

  return (
    <span
      style={{ display: "grid", placeItems: "center", width: size, height: size, flex: "0 0 auto", color, ...style }}
      {...rest}
    >
      {Glyph && (
        <Glyph width={size} height={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
      )}
    </span>
  );
}

export { GLYPHS };
