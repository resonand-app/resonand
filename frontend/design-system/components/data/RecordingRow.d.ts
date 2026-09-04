import * as React from "react";

/**
 * The dense list row: 36px tall, 800 recordings in 26 screens.
 * @startingPoint section="Data" subtitle="Dense recording rows with state and waveform" viewport="700x200"
 */
export interface RecordingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  /** Formatted duration, mono and tabular. */
  duration: string;
  state?: "none" | "running" | "done" | "failed";
  peaks?: number[];
  seed?: number;
  played?: number;
  pending?: boolean;
  /** Row is the current selection or the playing recording. */
  selected?: boolean;
  onOpen?: () => void;
}

export declare function RecordingRow(props: RecordingRowProps): React.JSX.Element;
