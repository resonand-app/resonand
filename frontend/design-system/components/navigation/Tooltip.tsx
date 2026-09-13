import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useAnchoredOverlay } from '../overlay/use-anchored-overlay';
import type { Placement } from '../overlay/use-anchored-overlay';

/** How long a pointer has to rest before a tooltip appears. */
const DWELL_MS = 400;

export interface TooltipProps {
  /** What it says. A phrase, not a sentence, and never the only place the information exists. */
  content: ReactNode;
  /** The control or text it describes. */
  children: ReactNode;
  placement?: Placement;
  /** Held open, for a specimen board. */
  open?: boolean;
}

/**
 * A truncated title in full, a technical field's meaning, an icon-only control's name
 * (`UI-34j`).
 *
 * **Never the only place information exists.** A tooltip cannot be reached by touch, cannot be
 * copied, and is gone the moment the pointer moves -- so anything that is only in one is
 * information the product does not really have. In particular **the permission wording never goes
 * in a tooltip**: `UI-34k` renders the API's `level_description` as visible text on every row, for
 * exactly this reason.
 *
 * It is the one overlay that does not trap focus. A tooltip describes the thing you are doing
 * rather than becoming it, and trapping a keyboard inside a hint about a control would strand it
 * on a description of something it can no longer reach -- so `UI-34a` is used with `modal: false`.
 *
 * Focus shows it at once and a pointer has to rest for `DWELL_MS` first. That asymmetry is
 * deliberate: a keyboard arrives on a control because somebody chose it, and a pointer crosses
 * six of them on the way somewhere else.
 */
export function Tooltip({ content, children, placement = 'top', open: openProp }: TooltipProps) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  const close = useCallback(() => {
    cancel();
    setOpenState(false);
  }, []);

  /* A tooltip whose control is unmounted mid-dwell -- a row that scrolls out of a virtualised
     list -- would otherwise open onto nothing a beat later. */
  useEffect(() => cancel, []);

  const { anchorRef, surfaceRef, surfaceStyle, id } = useAnchoredOverlay({
    open,
    onClose: close,
    placement,
    align: 'center',
    modal: false,
  });

  /* `aria-describedby` goes on the control and not on the wrapper around it. A description
     attached to a `<span>` that merely contains a button is a description nothing announces --
     the button is what focus lands on, so the button is what has to carry it. Anything that is
     not a single element (a bare string, a fragment) keeps the wrapper, which is the case where
     there is no control to describe. */
  const described =
    isValidElement(children) && open
      ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
          'aria-describedby': id,
        })
      : children;

  return (
    <>
      <span
        ref={anchorRef}
        style={{ display: 'inline-flex', maxWidth: '100%' }}
        onPointerEnter={() => {
          cancel();
          timer.current = setTimeout(() => {
            setOpenState(true);
          }, DWELL_MS);
        }}
        onPointerLeave={close}
        onFocus={() => {
          cancel();
          setOpenState(true);
        }}
        onBlur={close}
      >
        {described}
      </span>
      {open && (
        <div
          ref={surfaceRef}
          id={id}
          role="tooltip"
          data-ds="tooltip"
          style={{
            ...surfaceStyle,
            zIndex: 'var(--z-menu)',
            maxWidth: 230,
            padding: '7px 10px',
            borderRadius: 'var(--radius-chip)',
            boxShadow: 'var(--elevation-overlay)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--type-ui-size-sm)',
            lineHeight: 1.45,
            /* It describes the thing under the pointer; it must never be the thing the pointer
               lands on, or moving towards it would dismiss it and moving onto it would keep it. */
            pointerEvents: 'none',
          }}
        >
          {content}
        </div>
      )}
    </>
  );
}
