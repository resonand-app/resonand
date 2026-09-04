import * as React from "react";

/**
 * Transcription state. Always carries a glyph and a word, so colour is never the only signal.
 * @startingPoint section="Data" subtitle="The four transcription states" viewport="700x150"
 */
export interface StateBadgeProps extends React.HTMLAttributes<HTMLElement> {
  /** One of the four states the API reports. */
  state?: "none" | "running" | "done" | "failed";
  /** chip in cards and detail views; glyph in 36px dense rows where there is no room for a word. */
  variant?: "chip" | "glyph";
}

export declare function StateBadge(props: StateBadgeProps): React.JSX.Element;
export declare const STATES: Record<string, { label: string; icon: string; color: string }>;
