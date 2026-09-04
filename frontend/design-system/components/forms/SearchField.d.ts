import * as React from "react";

/**
 * The pill search field that sits in the centre of the top nav.
 * @startingPoint section="Forms" subtitle="Top-nav search, resting and focused" viewport="700x150"
 */
export interface SearchFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Keyboard hint shown at the right edge. Pass null to hide. */
  shortcut?: string | null;
  focused?: boolean;
}

export declare function SearchField(props: SearchFieldProps): React.JSX.Element;
