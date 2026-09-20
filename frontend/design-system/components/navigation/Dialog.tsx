import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** One line of consequence, especially for destructive confirms. */
  description?: string;
  /** Panel width in px. 420 default; 520 for share. */
  width?: number;
  onClose?: () => void;
  /** The copy, for an application that has its own (`UI-22a`). Names the close control. */
  labels?: { close?: string };
  /** Action row, right-aligned. Ghost Cancel first, then the primary or danger action. */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * A modal panel for create, rename, share and delete-confirm flows.
 *
 * `description` is where the consequence goes, in numbers: "Deleting this library also deletes its
 * 84 recordings." Never "Are you sure?" on its own.
 *
 * It is the panel; `Modal` is the modality around it -- the scrim, the focus trap, `Esc`, the
 * pointer outside and the locked page behind, settled once for every overlay in the system rather
 * than five times (`UI-34a`).
 *
 * It carries `aria-modal` even though it does not implement any of that, because the attribute is
 * a statement about the element with `role="dialog"` on it, and that element is this one. Without
 * it a screen reader's browse mode walks straight out of the panel into a page that is still
 * being read, which is the one failure the scrim and the trap do not cover: both are about where
 * focus and pointers may go, and a virtual cursor is neither (`UI-34a1`).
 *
 * **The background is not given the `inert` attribute**, and that is a decision rather than the
 * omission it looks like. Nothing here portals -- every overlay renders in the tree where it was
 * called -- so the only element that could carry it is an ancestor of the dialog as well as of
 * the page, which would make the dialog inert too. Portalling to `document.body` to get around
 * that would put the toast region inside the inert subtree, and `inert` takes an `aria-live`
 * region out of the accessibility tree: an upload finishing while a dialog is open would stop
 * being announced. `aria-modal` buys the same thing for assistive technology, the trap buys it
 * for the keyboard and the scrim buys it for the pointer, so the attribute would cost an
 * announcement and add nothing.
 */
export function Dialog({
  title,
  description,
  width = 420,
  onClose,
  labels,
  footer,
  children,
  style,
  ...rest
}: DialogProps) {
  return (
    <div
      style={{
        width,
        background: 'var(--surface)',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-overlay)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        ...style,
      }}
      role="dialog"
      aria-modal
      aria-label={title}
      data-ds="dialog"
      {...rest}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontWeight: 'var(--type-title-weight)',
              fontSize: 'var(--type-title-size)',
              letterSpacing: 'var(--type-title-tracking)',
              color: 'var(--text)',
            }}
          >
            {title}
          </h2>
          {description !== undefined && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-sans)',
                fontSize: 'var(--type-ui-size)',
                lineHeight: 'var(--type-body-leading)',
                color: 'var(--text-3)',
                textWrap: 'pretty',
              }}
            >
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={labels?.close ?? 'Close'}
          data-ds="dialog-close"
          data-hit-target=""
          style={{
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 'var(--radius-circle)',
            display: 'grid',
            placeItems: 'center',
            flex: '0 0 auto',
          }}
        >
          <Icon name="x" size={17} />
        </button>
      </div>
      {children}
      {footer !== undefined && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>
      )}
    </div>
  );
}
