import * as React from "react";

/**
 * A modal panel for create, rename, share and delete-confirm flows.
 * @startingPoint section="Navigation" subtitle="Modal panel with title, body and actions" viewport="700x300"
 */
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  /** One line of consequence, especially for destructive confirms. */
  description?: string;
  /** Panel width in px. 420 default; 520 for share. */
  width?: number;
  onClose?: () => void;
  /** Action row, right-aligned. Ghost Cancel first, then the primary or danger action. */
  footer?: React.ReactNode;
  children?: React.ReactNode;
}

export declare function Dialog(props: DialogProps): React.JSX.Element;
