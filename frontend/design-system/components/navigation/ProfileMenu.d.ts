import * as React from "react";

/**
 * The dialog behind the account button: identity, theme, Settings, Sign out. Nothing more.
 * @startingPoint section="Navigation" subtitle="Account menu with theme, settings, sign out" viewport="700x250"
 */
export interface ProfileMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string;
  email?: string;
  initials?: string;
  /** Current theme label: "Dark" or "Light". */
  theme?: string;
  onTheme?: () => void;
  onSettings?: () => void;
  onSignOut?: () => void;
}

export declare function ProfileMenu(props: ProfileMenuProps): React.JSX.Element;
