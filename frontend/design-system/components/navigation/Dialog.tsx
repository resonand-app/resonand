import type { HTMLAttributes, ReactNode } from 'react';

import { Icon } from '../foundation/Icon';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  /** One line of consequence, especially for destructive confirms. */
  description?: string;
  /** Panel width in px. 420 default; 520 for share. */
  width?: number;
  onClose?: () => void;
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
 * It is a panel and not yet a modality -- focus trapping, `Esc`, the outside click and the inert
 * background are `UI-34a`, which settles them once for every overlay in the system rather than
 * five times.
 */
export function Dialog({
  title,
  description,
  width = 420,
  onClose,
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
          aria-label="Close"
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
