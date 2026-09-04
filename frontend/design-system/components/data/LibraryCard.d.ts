import * as React from "react";

/**
 * A library on the landing page. 320x188, solid raised surface, no gradient.
 * @startingPoint section="Data" subtitle="Library card and the create-library tile" viewport="700x230"
 */
export interface LibraryCardProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  /** Mono metadata line, e.g. "3 recordings - 2 h 04 min". */
  meta?: string;
  /** The library colour the user picked, as a var(--library-*) reference. */
  colour?: string;
  /** Peaks of the library's most recent recording. */
  peaks?: number[];
  seed?: number;
  played?: number;
  /** True when the most recent recording has no peaks yet. */
  pending?: boolean;
  onOpen?: () => void;
}

export declare function LibraryCard(props: LibraryCardProps): React.JSX.Element;
