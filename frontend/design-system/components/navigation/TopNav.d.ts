import * as React from "react";

/**
 * The application's one top bar: sidebar toggle and logo left, search centre, upload and account right.
 * @startingPoint section="Navigation" subtitle="Top bar with search, upload and account" viewport="700x150"
 */
export interface TopNavProps extends React.HTMLAttributes<HTMLElement> {
  /** Account initials shown in the avatar button. */
  initials?: string;
  /** Current search text. */
  query?: string;
  searchFocused?: boolean;
  onToggleSidebar?: () => void;
  onUpload?: () => void;
  onProfile?: () => void;
  /** Rendered inside the search wrapper — pass SearchResults here so it anchors to the field. */
  children?: React.ReactNode;
}

export declare function TopNav(props: TopNavProps): React.JSX.Element;
