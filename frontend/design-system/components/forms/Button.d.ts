import * as React from "react";

/**
 * The system's text button. Pill-shaped at every size.
 * @startingPoint section="Forms" subtitle="Primary, secondary, ghost, danger" viewport="700x150"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary for the one main action per view; ghost for Cancel; danger for destructive confirms. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** Lucide icon name rendered before the label. */
  icon?: string;
  /** Renders the focus ring for specimen purposes; real focus comes from :focus-visible. */
  focused?: boolean;
  children?: React.ReactNode;
}

export declare function Button(props: ButtonProps): React.JSX.Element;
