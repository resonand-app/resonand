import { useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';

import { usePrefersReducedMotion } from '../../theme/reduced-motion';
import { useAnchoredOverlay } from '../overlay/use-anchored-overlay';

/** How far down a drag has to get before letting go dismisses rather than springs back. */
const DISMISS_AT = 64;

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Shown at the top, 17px Geist. Never Gabarito -- that is the page title and there is one. */
  title?: string;
  /** Names it when there is no visible title. */
  ariaLabel?: string;
  children?: ReactNode;
}

/**
 * The pattern the whole phone layout rests on (`UI-34g`).
 *
 * The phone's metadata panel and its filter bar (§2.3). It is drawn now, before the phone shell
 * that needs it, because `DEC-23` builds that shell from prose and a component drawn afterwards
 * would be a component shaped by whichever view got there first.
 *
 * Three things make it a sheet rather than a dialog at the bottom of the screen. **The grabber**,
 * which is the only affordance saying it can be dragged. **The drag itself**: it follows the
 * finger down and springs back if the finger stops short, so the gesture is reversible while it
 * is happening rather than after. And **the page under it stops scrolling**, which a menu must
 * never do and a cover always must.
 *
 * It is `role="dialog"` and `aria-modal`, which is what it is: focus is trapped inside it and the
 * rest of the page is not available while it is up. `Esc` closes it, and so does the scrim --
 * both from `UI-34a`, which is also where the focus trap comes from.
 *
 * The drag never animates on its own. While a finger is down the transform follows the finger,
 * which is not motion the interface chose; when it is let go the spring back is a transition, and
 * that transition is the one thing here `prefers-reduced-motion` turns off (`UI-32c`).
 */
export function Sheet({ open, onClose, title, ariaLabel, children }: SheetProps) {
  const reduced = usePrefersReducedMotion();
  const [drag, setDrag] = useState(0);
  /* Whether a finger is down is state and not a ref, because the spring-back transition is
     switched off while it is: a transform that follows a finger must not be animated, and one
     that returns on its own must be. A ref would be the same fact read during render. */
  const [dragging, setDragging] = useState(false);
  const from = useRef<number | null>(null);
  /* How far the finger got, in a ref as well as in state. The state is what draws the sheet; the
     ref is what the release reads, because a pointer move is a continuous event and React is
     under no obligation to have flushed its state by the time the finger comes up. Reading the
     state there is a dismissal that works in a browser and not in a test, or the other way
     round on a slower machine. */
  const travelled = useRef(0);

  const { surfaceRef, id } = useAnchoredOverlay({
    open,
    onClose,
    anchored: false,
    lockScroll: true,
  });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    from.current = event.clientY;
    travelled.current = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (from.current === null) return;
    // Down only. A sheet dragged upwards is a sheet somebody is trying to make taller, and it
    // has one height.
    travelled.current = Math.max(0, event.clientY - from.current);
    setDrag(travelled.current);
  };

  const onPointerUp = () => {
    if (from.current === null) return;
    const distance = travelled.current;
    from.current = null;
    travelled.current = 0;
    setDragging(false);
    setDrag(0);
    if (distance > DISMISS_AT) onClose();
  };

  if (!open) return null;

  return (
    <>
      <div
        data-ds="scrim"
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 'var(--z-scrim)',
        }}
      />
      <div
        ref={surfaceRef}
        id={id}
        role="dialog"
        aria-modal
        aria-label={title ?? ariaLabel}
        tabIndex={-1}
        data-ds="sheet"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 'var(--z-dialog)',
          maxHeight: '85vh',
          overflowY: 'auto',
          borderRadius: 'var(--radius-panel) var(--radius-panel) 0 0',
          boxShadow: 'var(--elevation-overlay)',
          padding: '10px 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          translate: `0 ${String(drag)}px`,
          transition: dragging || reduced ? 'none' : 'translate var(--transition-panel)',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span
          data-ds="sheet-grabber"
          aria-hidden
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 'var(--radius-pill)',
            flex: '0 0 auto',
          }}
        />
        {title !== undefined && (
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-sans)',
              fontSize: 'var(--type-body-size)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text)',
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </>
  );
}
