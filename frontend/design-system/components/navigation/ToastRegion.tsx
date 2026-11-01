import { useEffect, useRef, useState } from 'react';
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

/**
 * One toast's own timer, so a stack of three does not expire together, and held while the pointer
 * or the focus is inside it -- reaching for a button must never race the clock that removes it.
 */
function Timed({
  entry,
  onDismiss,
}: {
  entry: ToastEntry;
  onDismiss: (id: string) => void;
}) {
  const { id, timeout } = entry;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const left = useRef(timeout ?? DEFAULT_TIMEOUT);
  const held = hovered || focused;

  useEffect(() => {
    if (timeout === null || held) return;
    const started = Date.now();
    const timer = setTimeout(() => {
      onDismiss(id);
    }, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [id, onDismiss, timeout, held]);

  return (
    <div
      data-ds="toast-slot"
      style={{ pointerEvents: 'auto', maxWidth: '100%' }}
      onPointerEnter={() => {
        setHovered(true);
      }}
      onPointerLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {entry.content}
    </div>
  );
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
 * **The product shows one at a time** (`UI-46`): the app's store replaces the toast on screen with
 * the newer one rather than stacking them, so what is showing is always the latest answer. The
 * region still stacks whatever it is given, and draws the newest at the bottom.
 *
 * Each toast holds its own timer, so a stack of three does not expire together; the timer waits
 * while the pointer or the focus is inside its toast; and a failure carrying a retry takes
 * `timeout: null` -- an action nobody had time to read is an action nobody was offered.
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
        <Timed key={entry.id} entry={entry} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
