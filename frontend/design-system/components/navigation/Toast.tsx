import type { ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import { IconButton } from '../forms/IconButton';

export interface ToastProps {
  /** `done` is one line and a tick; `failed` is multi-line and carries actions. */
  tone?: 'done' | 'failed';
  /** What happened, in numbers. "12 recordings moved to Àvia Teresa". */
  children: ReactNode;
  /** Buttons for a failure: a retry, and a way to put it away. */
  actions?: ReactNode;
  onDismiss?: () => void;
}

/**
 * Something finished while you were looking somewhere else (`UI-34h`).
 *
 * Bulk outcomes, an upload finishing, a background failure. Success is one line and a tick;
 * failure is multi-line, says what succeeded and what did not, and carries the retry -- because
 * the normal case for a bulk action in this product is partial (§3.5: there is no bulk endpoint,
 * so 200 recordings is 200 requests, and some of them fail).
 *
 * **Never the only place a result exists.** A toast is a courtesy for somebody who was looking
 * elsewhere, and it is gone in a few seconds; the recordings that failed to move are still
 * selected, the upload tray still shows the file that did not go, the job still says failed. If a
 * result exists nowhere else, it is not a toast -- it is a state, and it belongs on the screen.
 *
 * **It is not built on `UI-34a`, and that is not an omission.** The anchored overlay places a
 * surface against a control; a toast has no anchor. It is placed above the player by
 * `ToastRegion` (`UI-35f`), which is also where the polite live region, the stacking and the
 * timers live -- one region for all of them, because two toasts announcing themselves over each
 * other is a screen reader nobody can follow. This component draws one, and knows nothing about
 * where it is.
 */
export function Toast({ tone = 'done', children, actions, onDismiss }: ToastProps) {
  const failed = tone === 'failed';

  return (
    <div
      data-ds="toast"
      data-tone={tone}
      style={{
        display: 'flex',
        alignItems: failed ? 'flex-start' : 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-overlay)',
        fontFamily: 'var(--font-sans)',
        maxWidth: 420,
      }}
    >
      <span data-ds="toast-glyph" style={{ display: 'flex', paddingTop: failed ? 1 : 0 }}>
        <Icon name={failed ? 'alert-circle' : 'check'} size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={{
            fontSize: 'var(--type-ui-size)',
            lineHeight: 'var(--type-body-leading)',
            color: 'var(--text)',
          }}
        >
          {children}
        </span>
        {actions !== undefined && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
      </div>
      {onDismiss !== undefined && (
        <IconButton icon="x" variant="ghost" size={26} label="Dismiss" onClick={onDismiss} />
      )}
    </div>
  );
}
