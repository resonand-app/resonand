import * as React from "react";

export interface SidebarLibrary {
  id?: string;
  name: string;
  /** var(--library-*) reference. */
  colour: string;
  /** Recording count, mono and tabular. */
  count?: number;
}

/**
 * The toggleable left bar: libraries you own, libraries shared with you, then Trash and Settings.
 * @startingPoint section="Navigation" subtitle="Left bar, expanded and collapsed" viewport="700x420"
 */
export interface SidebarProps extends React.HTMLAttributes<HTMLElement> {
  own?: SidebarLibrary[];
  shared?: SidebarLibrary[];
  trashCount?: number;
  /** Collapsed to 52px: icons only, libraries hidden behind the Libraries destination. */
  collapsed?: boolean;
  /** Current destination: "libraries", "trash", "settings", or a library id. */
  activeId?: string;
  onSelect?: (id: string) => void;
}

export declare function Sidebar(props: SidebarProps): React.JSX.Element;
