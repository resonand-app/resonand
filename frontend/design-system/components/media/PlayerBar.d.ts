import * as React from "react";

/**
 * The persistent player. Survives navigation; one instance per session, pinned to the bottom of the shell.
 * @startingPoint section="Media" subtitle="Persistent player with transport and waveform" viewport="700x150"
 */
export interface PlayerBarProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Library name shown beneath the title. */
  library?: string;
  peaks?: number[];
  seed?: number;
  /** Formatted elapsed time, mono and tabular. */
  position?: string;
  duration?: string;
  /** Played fraction, 0-1. Must agree with the position label. */
  played?: number;
  playing?: boolean;
  /** Playback rate label, e.g. 1.0x, 1.25x. */
  speed?: string;
  onToggle?: () => void;
}

export declare function PlayerBar(props: PlayerBarProps): React.JSX.Element;
