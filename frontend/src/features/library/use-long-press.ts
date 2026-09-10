/**
 * Long-press to start a selection (`UI-24b`, §2.3).
 *
 * `UI-9a` reveals the checkbox on hover, on focus, or once a selection already exists. All three
 * are desktop facts. A phone has no hover, no tab key to focus with, and no selection yet -- so
 * on the one device where selecting a few recordings while walking is the likely case, **there
 * was no way to begin one at all**. The checkbox was there, `visibility: hidden`, waiting for a
 * pointer that does not exist.
 *
 * A long press is the gesture every phone already teaches: it is how a photo library, a mail app
 * and a file browser all enter selection. So it is not a new idea to learn, which is the only
 * kind of gesture worth adding to a product that has otherwise none.
 *
 * **Three things it must not do**, and each is a real failure rather than a hypothetical:
 *
 * - **Fire while scrolling.** A finger resting on a card for half a second on the way down a long
 *   library is the commonest touch there is. Movement past a small tolerance cancels the press.
 * - **Open the recording as well.** The card is an anchor; a press that selects and then follows
 *   the link has selected nothing anybody can see. The click after a fired press is swallowed.
 * - **Raise the platform's own menu.** Android answers a long press with a context menu over the
 *   top of whatever the page did. It is suppressed for as long as the gesture is armed.
 *
 * **Touch and pen only.** A mouse has hover, which is `UI-9a`'s answer and a better one -- and a
 * mouse button held down over a list is somebody about to drag-select text, not somebody asking
 * for a selection. Gating on the pointer type rather than on the viewport width is what makes
 * this right on a touchscreen laptop, where both answers are true at once.
 */

import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';

/** How long a press has to last. The platform convention, and long enough not to catch a tap. */
export const LONG_PRESS_MS = 500;

/**
 * How far a finger may wander and still count as a press, in CSS pixels.
 *
 * Small, because the gesture competes with scrolling and scrolling has to win: a finger that has
 * travelled ten pixels is on its way somewhere.
 */
export const MOVE_TOLERANCE_PX = 10;

/** The props to spread onto whatever a press should select. Empty when there is nothing to do. */
export interface LongPressHandlers {
  onPointerDown?: (event: ReactPointerEvent) => void;
  onPointerMove?: (event: ReactPointerEvent) => void;
  onPointerUp?: () => void;
  onPointerCancel?: () => void;
  onContextMenu?: (event: ReactMouseEvent) => void;
}

export interface LongPress {
  /** Spread onto the element a press should select. */
  handlers: LongPressHandlers;
  /**
   * Whether the act now arriving is the tail of a press that already selected, consuming it.
   *
   * A touch that fires a press still produces a click afterwards, and that click means "open
   * this recording" to everything downstream of it. Who has to ask differs by surface, which is
   * why this is a question rather than another handler: the card is an anchor and cancels the
   * click itself, while the row already owns its `onClick` and would lose it to a spread prop --
   * so the row asks here, inside the opening it was going to do anyway.
   */
  consumedByPress: () => boolean;
}

export function useLongPress(onLongPress?: () => void): LongPress {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const from = useRef<{ x: number; y: number } | null>(null);
  /** Whether the press fired, so the click it turns into can be swallowed. */
  const fired = useRef(false);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    from.current = null;
  };

  // A card unmounted mid-press -- which a virtualised list does constantly -- must not leave a
  // timer that fires into a component nobody is looking at any more.
  useEffect(() => cancel, []);

  const consumedByPress = () => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  };

  if (onLongPress === undefined) return { handlers: {}, consumedByPress };

  const handlers: LongPressHandlers = {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse') return;
      fired.current = false;
      from.current = { x: event.clientX, y: event.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        cancel();
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (event) => {
      const start = from.current;
      if (start === null) return;
      const travelled = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (travelled > MOVE_TOLERANCE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event) => {
      event.preventDefault();
    },
  };

  return { handlers, consumedByPress };
}
