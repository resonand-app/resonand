import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CircleAlert,
  CircleDashed,
  Clock,
  CloudUpload,
  Download,
  EllipsisVertical,
  FileAudio,
  FileVideo,
  FolderInput,
  HardDrive,
  LayoutGrid,
  Library,
  Loader,
  LogOut,
  Minus,
  Moon,
  PanelLeft,
  Pause,
  Pencil,
  Play,
  Plus,
  Rows3,
  Search,
  Share2,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sun,
  Tag,
  TextAlignStart,
  Trash,
  Upload,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { createElement } from 'react';
import type { HTMLAttributes } from 'react';

/**
 * The glyphs this system registers (`UI-1b`).
 *
 * Written out rather than derived from the name, which costs a line each and buys two things.
 * It is what makes the import tree-shakeable: `lucide-react`'s entry point exports some fourteen
 * hundred icons, and a lookup like `icons[name]` keeps a reference to all of them -- measured at
 * 759 KB minified against 2.6 KB for three named imports, four times the whole application
 * bundle for glyphs nothing asks for. And it absorbs upstream's renames: four of these names are
 * deprecated aliases in Lucide 1.x, so `align-left` is `TextAlignStart`, `alert-circle` is
 * `CircleAlert`, `more-vertical` is `EllipsisVertical` and `trash-2` is `Trash`. The system's own
 * vocabulary did not move, and the day the aliases are dropped is a four-line diff in this file.
 *
 * These are the glyphs the README documents plus the ones components ask for by computed name --
 * `StateBadge`'s four states, `SearchResults`' two kinds of hit. Adding one is two lines here,
 * and `UI-34` adds a handful: `chevron-down` for the control that opens a list of values, `minus` for a checkbox that is neither
 * on nor off, `pencil` for a field you can correct in place, and
 * `hard-drive` and `cloud-upload` for the two registers of the egress disclosure. `UI-8d` adds
 * three: `chevron-up` for a sort that currently runs the other way, and `layout-grid` and `rows`
 * for the switch between the two densities of one library. `sun` is `moon`'s other half, for the
 * account menu's theme row, which shows the theme somebody is in rather than the word "Theme".
 * `download` and `folder-input` are a recording's two actions that move it somewhere.
 * `file-audio` and `file-video` are the upload dialog's two kinds of chosen file, which is the
 * one place the distinction is drawn before a recording exists to draw it on.
 */
const GLYPHS = {
  'align-left': TextAlignStart,
  'alert-circle': CircleAlert,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-up': ChevronUp,
  'circle-dashed': CircleDashed,
  clock: Clock,
  'cloud-upload': CloudUpload,
  download: Download,
  'file-audio': FileAudio,
  'file-video': FileVideo,
  'folder-input': FolderInput,
  'hard-drive': HardDrive,
  library: Library,
  loader: Loader,
  'log-out': LogOut,
  moon: Moon,
  minus: Minus,
  'more-vertical': EllipsisVertical,
  'layout-grid': LayoutGrid,
  'panel-left': PanelLeft,
  pause: Pause,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  search: Search,
  rows: Rows3,
  'share-2': Share2,
  'skip-back': SkipBack,
  'skip-forward': SkipForward,
  'sliders-horizontal': SlidersHorizontal,
  sun: Sun,
  tag: Tag,
  'trash-2': Trash,
  upload: Upload,
  x: X,
} as const satisfies Record<string, LucideIcon>;

/** A registered glyph name. Not any Lucide name -- the registry is the vocabulary. */
export type IconName = keyof typeof GLYPHS;

/**
 * The registry read by a name that has not been checked.
 *
 * `name` is typed, so within the application this cannot miss. It can still miss at runtime: a
 * glyph chosen from data, a name assembled from a state string, a caller that is not TypeScript.
 * That is the case the loud failure below exists for, and giving the lookup a type that admits
 * it is what keeps the check from reading as dead code.
 */
function glyphFor(name: string): LucideIcon | undefined {
  return (GLYPHS as Record<string, LucideIcon | undefined>)[name];
}

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  /** A registered glyph name, kebab-case, e.g. "search", "upload", "panel-left". */
  name: IconName;
  /** Rendered box in px. 17 in rows and buttons, 15 for state glyphs, 21 in the nav. */
  size?: number | undefined;
  /** Stroke weight. Leave at 1.7 unless the glyph sits under 15px. */
  strokeWidth?: number | undefined;
  /** Defaults to currentColor so the parent controls it.
   *
   *  Explicitly `| undefined`, like the two above. Under `exactOptionalPropertyTypes` a caller
   *  spreading its own props through -- which is what `StateBadge` and every other wrapper does --
   *  cannot pass a value that might be absent to a merely optional prop. Requiring each of them
   *  to strip the key first would buy nothing and be forgotten once. */
  color?: string | undefined;
}

/**
 * A single Lucide glyph at the system's stroke weight.
 *
 * Use it for every icon in the interface rather than inlining SVG. The `name` string API is the
 * point: a screen never imports a glyph, so this stays the one file that changes if a real icon
 * set ever arrives.
 */
export function Icon({
  name,
  size = 17,
  strokeWidth = 1.7,
  color = 'currentColor',
  style,
  ...rest
}: IconProps) {
  const Glyph = glyphFor(name);

  /* Loudly in development, quietly in production. An unknown name used to render an empty `<i>`
     that looked like a spacing bug and got debugged as one; now it stops the person who typed
     it. In front of somebody using the product it stays a missing glyph in a box of the right
     size, because a blank screen is not an improvement on a missing icon. */
  if (Glyph === undefined) {
    if (import.meta.env.DEV) {
      throw new Error(
        `Icon: no glyph named "${name}". Add it to GLYPHS in components/foundation/Icon.tsx.`,
      );
    }
    console.error(`Icon: no glyph named "${name}".`);
  }

  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        flex: '0 0 auto',
        color,
        ...style,
      }}
      {...rest}
    >
      {/* `createElement` rather than `<Glyph />`: the lint rule that watches for a component
          defined during render cannot tell that apart from one looked up during render, and
          this is a lookup in a frozen module-level table. The identity is stable for a given
          `name`, so nothing remounts -- which is the thing the rule exists to prevent. */}
      {Glyph !== undefined &&
        createElement(Glyph, {
          width: size,
          height: size,
          strokeWidth,
          'aria-hidden': true,
          focusable: 'false',
        })}
    </span>
  );
}
