import * as React from "react";

/**
 * A tag or filter pill. Used for recording tags, language, and sort selection.
 * @startingPoint section="Data" subtitle="Tag and filter pills" viewport="700x150"
 */
export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Selected filter or applied tag. */
  active?: boolean;
  children?: React.ReactNode;
}

export declare function Chip(props: ChipProps): React.JSX.Element;
