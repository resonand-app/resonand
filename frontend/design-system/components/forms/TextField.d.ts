import * as React from "react";

/**
 * Single-line text input with optional label and error.
 * @startingPoint section="Forms" subtitle="Text input, focused and error states" viewport="700x150"
 */
export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Error message. Presence switches the field to its error treatment. */
  error?: string;
  /** Renders the focus ring for specimen purposes. */
  focused?: boolean;
}

export declare function TextField(props: TextFieldProps): React.JSX.Element;
