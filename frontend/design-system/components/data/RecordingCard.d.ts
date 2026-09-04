import * as React from "react";

/**
 * A recording as a card, for the grid view of a library.
 * @startingPoint section="Data" subtitle="Recording card with state and tags" viewport="700x240"
 */
export interface RecordingCardProps extends React.HTMLAttributes<HTMLElement> {
  name: string;
  /** Mono metadata: duration and date, e.g. "48:12 - 12 Mar 2026". */
  meta?: string;
  state?: "none" | "running" | "done" | "failed";
  /** User-entered tags, shown verbatim. */
  tags?: string[];
  peaks?: number[];
  seed?: number;
  played?: number;
  pending?: boolean;
  onPlay?: () => void;
}

export declare function RecordingCard(props: RecordingCardProps): React.JSX.Element;
