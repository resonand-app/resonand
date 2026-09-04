import * as React from "react";

/**
 * The seven library colours as a single row of swatches. The user picks one; a library's colour is never derived.
 * @startingPoint section="Forms" subtitle="The seven library colours" viewport="700x150"
 */
export interface ColorSwatchPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Selected colour name: amber | clay | slate | moss | stone | plum | teal. */
  value?: string;
  onChange?: (name: string) => void;
  /** Swatch diameter in px. */
  size?: number;
  /** Inline label. Pass null to omit. */
  label?: string | null;
}

export declare function ColorSwatchPicker(props: ColorSwatchPickerProps): React.JSX.Element;
export declare const LIBRARY_COLORS: { name: string; value: string }[];
