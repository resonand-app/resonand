import * as React from "react";

/**
 * The signature element: amplitude sampled into rounded bars.
 * @startingPoint section="Media" subtitle="Rounded-bar waveform at every documented size" viewport="700x300"
 */
export interface WaveformProps extends React.SVGAttributes<SVGSVGElement> {
  /** Stored peaks, 0-1, computed once on ingest. Always pass these in production. */
  peaks?: number[];
  /** Mock seed, used only when peaks is absent. Specimens and prototypes only. */
  seed?: number;
  /** 20 dense row - 38 library card - 52 recording card - 34 player - 130 audio detail. */
  height?: number;
  /** Played fraction, 0-1. Played bars take --wave, the rest --wave-dim. */
  played?: number;
  /** Draws the 2px rounded playhead. On in the player and on audio detail. */
  playhead?: boolean;
  /** Override bar width. Defaults by height; 2px under 26px tall. */
  barWidth?: number;
  /** The peaks job has not run: renders a dashed rule, never a fake shape. */
  pending?: boolean;
}

export declare function Waveform(props: WaveformProps): React.JSX.Element;
export declare function generatePeaks(seed: number, count: number): number[];
