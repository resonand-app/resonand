import * as React from "react";

/**
 * One timestamped line of transcript. Click to seek; the active line follows playback.
 * @startingPoint section="Media" subtitle="Synced transcript lines, active and resting" viewport="700x150"
 */
export interface TranscriptLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Timestamp, mono and tabular, e.g. 18:04. */
  at: string;
  /** True for the line currently being spoken. Exactly one at a time. */
  active?: boolean;
  children?: React.ReactNode;
}

export declare function TranscriptLine(props: TranscriptLineProps): React.JSX.Element;
