import * as React from "react";

/**
 * The Sonarium mark, optionally with the Chillax wordmark beside it.
 * @startingPoint section="Foundation" subtitle="Mark and wordmark lockup" viewport="700x150"
 */
export interface LogoProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Mark size in px. 21 in the nav, 26–28 at rest, 40+ on the login screen. */
  size?: number;
  /** Set false for the mark alone (favicon, collapsed nav, avatar tile). */
  showWordmark?: boolean;
  /** Stroke colour of the mark. Defaults to the accent. */
  color?: string;
}

export declare function Logo(props: LogoProps): React.JSX.Element;
