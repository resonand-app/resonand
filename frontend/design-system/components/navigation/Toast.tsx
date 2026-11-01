import type { ReactNode } from 'react';

import { Icon } from '../foundation/Icon';
import { IconButton } from '../forms/IconButton';

export interface ToastProps {
  /** `done` is one line and a tick; `failed` is multi-line and says what did not happen. */
  tone?: 'done' | 'failed';
  /** What happened, in numbers. "12 recordings moved to Field recordings". */
  children: ReactNode;
  /** One thing to do about it: a retry after a failure, an undo after something reversible. */
  actions?: ReactNode;
  onDismiss?: () => void;
}

/**
 * Something finished while you were looking somewhere else (`UI-34h`).
 *
 * Bulk outcomes, an upload finishing, a background failure. Success is a tick, and may carry an
 * undo where the thing it reports can be taken back exactly; failure says what succeeded and what
 * did not, and carries the retry -- because the normal case for a bulk action in this product is
 * partial (§3.5: there is no bulk endpoint, so 200 recordings is 200 requests, and some of them
 * fail).
 *
 * **One line wherever the width allows, its button included** (`UI-46`). The sentence and the
 * button sit side by side and wrap only when they do not fit the window, so the toast is as short
 * as it can be over the view it covers. No width of its own: the region's is the only limit.
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
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 'var(--radius-panel)',
        boxShadow: 'var(--elevation-overlay)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span data-ds="toast-glyph" style={{ display: 'flex' }}>
        <Icon name={failed ? 'alert-circle' : 'check'} size={17} />
      </span>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 12,
          rowGap: 6,
        }}
      >
        <span
          style={{
            flex: '1 1 auto',
            minWidth: 0,
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
