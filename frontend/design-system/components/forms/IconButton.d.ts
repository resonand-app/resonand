import * as React from "react";

/**
 * A round icon-only control. 32px visual, 44px hit target.
 * @startingPoint section="Forms" subtitle="Round icon control, filled and ghost" viewport="700x150"
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Lucide icon name. */
  icon: string;
  variant?: "filled" | "ghost";
  /** Visual diameter in px. 32 default, 38 for the player's play control. */
  size?: number;
  /** Required — the control has no visible label. */
  label: string;
  /** Renders the accent-soft active fill (current nav destination, engaged toggle). */
  active?: boolean;
}

export declare function IconButton(props: IconButtonProps): React.JSX.Element;
