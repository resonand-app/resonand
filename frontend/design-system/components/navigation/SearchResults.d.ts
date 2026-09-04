import * as React from "react";

export interface SearchHit {
  /** "recording" shows a transcript excerpt; "library" shows a library. */
  kind?: "recording" | "library";
  title: string;
  /** Matching transcript line, or the library's own metadata. */
  excerpt?: string;
  /** Timestamp of the match inside the recording, e.g. "18:04". */
  at?: string;
}

/**
 * The quick-hits dropdown beneath the top-nav search field. Enter goes to the full search view.
 * @startingPoint section="Navigation" subtitle="Search quick hits with transcript excerpts" viewport="700x250"
 */
export interface SearchResultsProps extends React.HTMLAttributes<HTMLDivElement> {
  hits?: SearchHit[];
  /** Total match count, shown on the see-all row. */
  total?: number;
  query?: string;
  onOpen?: (hit: SearchHit) => void;
  onSeeAll?: () => void;
}

export declare function SearchResults(props: SearchResultsProps): React.JSX.Element;
