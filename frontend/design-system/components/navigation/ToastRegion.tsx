import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { usePrefersReducedMotion } from '../../theme/reduced-motion';

export interface ToastEntry {
  id: string;
  /** A `Toast`. The region places and announces it; the toast draws itself. */
  content: ReactNode;
  /**
   * Milliseconds until it goes on its own. `null` stays until dismissed, which is what a failure
   * carrying a retry does -- an action nobody had time to read is an action nobody was offered.
   */
  timeout?: number | null;
}

export interface ToastRegionProps {
  toasts: ToastEntry[];
  onDismiss: (id: string) => void;
  /** Whether the player is on screen. The stack sits above it rather than over it. */
  playerVisible?: boolean;
}

/** How long an ordinary success stays. */
const DEFAULT_TIMEOUT = 6000;

/** One toast's own timer, so a stack of three does not expire together. */
function Timed({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  const { id, timeout } = entry;

  useEffect(() => {
    if (timeout === null) return;
    const after = timeout ?? DEFAULT_TIMEOUT;
    const timer = setTimeout(() => {
      onDismiss(id);
    }, after);
    return () => {
      clearTimeout(timer);
    };
  }, [id, onDismiss, timeout]);

  return <>{entry.content}</>;
}

/**
 * Where toasts go, and how they are announced (`UI-35f`).
 *
 * One region for all of them, and that is the whole reason it exists: two toasts announcing
 * themselves over each other is a screen reader nobody can follow, and two stacks in two corners
 * is a product where the answer to "did that work?" depends on which corner you looked at.
 *
 * **`aria-live="polite"` and not `assertive`.** A toast reports something that has already
 * happened; interrupting somebody mid-sentence to tell them an upload finished is the behaviour
 * `assertive` exists for and this is not it. The region is in the DOM from the first render with
 * nothing in it, because a live region added to the page at the same moment as its content is a
 * live region that announces nothing.
 *
 * **It sits above the player rather than over it.** The player is the one control that has to stay
 * reachable while anything else is happening, and a toast covering the play button while an
 * upload finishes is the one moment somebody is most likely to reach for it.
 *
 * Each toast holds its own timer, so a stack of three does not expire together, and a failure
 * carrying a retry takes `timeout: null` -- an action nobody had time to read is an action nobody
 * was offered.
 */
export function ToastRegion({ toasts, onDismiss, playerVisible = false }: ToastRegionProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      data-ds="toast-region"
      role="status"
      aria-live="polite"
      aria-atomic={false}
      style={{
        position: 'fixed',
        left: 'var(--panel-gap)',
        right: 'var(--panel-gap)',
        bottom: playerVisible
          ? 'calc(var(--player-height) + var(--panel-gap) * 2)'
          : 'var(--panel-gap)',
        zIndex: 'var(--z-toast)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-2)',
        /* The region spans the width so its children can be centred, and lets every pointer
           through: an empty live region must not be a sheet of glass over the view. */
        pointerEvents: 'none',
        transition: reduced ? 'none' : 'bottom var(--transition-panel)',
      }}
    >
      {toasts.map((entry) => (
        <div key={entry.id} style={{ pointerEvents: 'auto', maxWidth: '100%' }}>
          <Timed entry={entry} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
