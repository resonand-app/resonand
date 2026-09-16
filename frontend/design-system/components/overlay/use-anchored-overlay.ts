import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';

/**
 * Where an overlay goes relative to the thing that opened it.
 *
 * Four, and no corner variants. Every overlay in this product is a menu, a listbox, a tooltip or
 * a sheet, and each of those is below, above, or beside its anchor -- a `top-start` that behaves
 * differently from a `top` is a distinction nobody using the interface can see.
 */
export type Placement = 'bottom' | 'top' | 'right' | 'left';

/** Which edge of the anchor the overlay lines up with. */
export type Alignment = 'start' | 'center' | 'end';

export interface AnchoredOverlayOptions {
  /** Whether the overlay is on screen. The caller owns this. */
  open: boolean;
  /** Asked to close: `Esc`, or a pointer outside both the surface and its anchor. */
  onClose: () => void;
  /** Preferred side. It flips to the opposite side when that one is roomier (`UI-34a`). */
  placement?: Placement;
  /** Which edge to line up with. */
  align?: Alignment;
  /** Gap between the anchor and the overlay, in px. */
  offset?: number;
  /**
   * Whether the overlay traps focus.
   *
   * True for anything you act inside -- a menu, a listbox, a sheet. **False for a tooltip**,
   * which describes something without becoming the thing you are doing: trapping focus in a
   * tooltip would strand a keyboard on a hint about a control it can no longer reach.
   */
  modal?: boolean;
  /**
   * Whether the page behind stops scrolling while this is open.
   *
   * Off by default, and on for `Sheet`. A menu wants the opposite: the page keeps scrolling and
   * the menu follows its anchor, because a menu is attached to a row in a list and a locked page
   * would make that list unusable while one was open. A sheet covers the page, and a page
   * scrolling under a cover is a page nobody asked to move.
   */
  lockScroll?: boolean;
  /**
   * Whether the surface is placed against the anchor at all.
   *
   * True for everything with a control behind it. **False for `Sheet`**, which is anchored to the
   * bottom of the viewport rather than to anything on the page -- it still wants the focus trap,
   * the `Esc`, the outside click and the scroll lock, and it places itself.
   */
  anchored?: boolean;
}

export interface AnchoredOverlay<Anchor extends HTMLElement, Surface extends HTMLElement> {
  /** Put this on the control that opens the overlay. */
  anchorRef: RefObject<Anchor | null>;
  /** Put this on the overlay's own root. */
  surfaceRef: RefObject<Surface | null>;
  /**
   * Spread this on the surface before any style of your own, and do not set `position`, `top`,
   * `left` or `visibility` yourself -- those four are written straight to the element.
   */
  surfaceStyle: CSSProperties;
  /** A stable id, for wiring `aria-controls` and `aria-labelledby` across the pair. */
  id: string;
}

/**
 * The style the surface starts in: fixed, and not yet visible.
 *
 * Frozen and shared, so spreading it costs nothing and React sees one object on every render.
 * `visibility` rather than `display`, because the surface has to be laid out to be measured -- a
 * `display: none` overlay has no size and cannot be placed against anything.
 */
const SURFACE_STYLE: CSSProperties = Object.freeze({
  position: 'fixed',
  top: 0,
  left: 0,
  visibility: 'hidden',
});

/** What an unanchored surface gets instead: nothing, because it places itself. */
const EMPTY_STYLE: CSSProperties = Object.freeze({});

/** Everything a keyboard can land on inside an overlay, in the order it would land on them. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex^="-"])';

/**
 * What a surface marks as the control it should open on.
 *
 * An attribute rather than a ref, because the control is usually several components down -- a
 * `TextField` inside a `Dialog` inside a `Modal` -- and a ref would have to be threaded through
 * every one of them, including the ones that do not forward it.
 */
const INITIAL_FOCUS = '[data-initial-focus]';

/**
 * The focusables inside an overlay.
 *
 * `hidden` is the only visibility test made. The obvious stronger one -- `offsetParent !== null`,
 * or an empty `getClientRects()` -- is a layout question, and layout is the one thing jsdom does
 * not do: both answer "invisible" for every element in every test, which would turn the focus
 * trap into a trap with nothing in it exactly where it is being checked.
 */
function focusableIn(surface: HTMLElement): HTMLElement[] {
  return [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => !element.hidden);
}

/** The viewport, with a fallback for an environment that has no layout to report. */
function viewport(): { width: number; height: number } {
  return { width: window.innerWidth || 1280, height: window.innerHeight || 800 };
}

const OPPOSITE: Record<Placement, Placement> = {
  bottom: 'top',
  top: 'bottom',
  right: 'left',
  left: 'right',
};

/**
 * Where the surface should sit, measured against the anchor.
 *
 * Measured rather than guessed, and re-measured on every open: a menu whose last item is "Delete
 * permanently" cannot be allowed to render below the fold, and the only way to know whether it
 * would is to ask both boxes how big they are.
 */
function place(
  anchor: HTMLElement,
  surface: HTMLElement,
  placement: Placement,
  align: Alignment,
  offset: number,
): { top: number; left: number; placed: Placement } {
  const a = anchor.getBoundingClientRect();
  const s = surface.getBoundingClientRect();
  const { width, height } = viewport();

  const room: Record<Placement, number> = {
    bottom: height - a.bottom - offset,
    top: a.top - offset,
    right: width - a.right - offset,
    left: a.left - offset,
  };
  const vertical = placement === 'bottom' || placement === 'top';
  const need = vertical ? s.height : s.width;

  /* Flip only when the preferred side does not fit *and* the other one is roomier. Both halves
     matter: without the first, a menu moves for no reason and the pointer has to go looking for
     it; without the second, a menu that fits nowhere -- a long one on a short window -- would
     move to a side that is no better and lose the same items off a different edge. */
  const placed =
    room[placement] < need && room[OPPOSITE[placement]] > room[placement]
      ? OPPOSITE[placement]
      : placement;

  /* Clamped into the viewport on the cross axis, so a menu on a card at the right edge of a grid
     is fully readable rather than half of one. 8px, which is the gap the shell already leaves. */
  const clamp = (value: number, size: number, limit: number) =>
    Math.max(8, Math.min(value, limit - size - 8));

  if (placed === 'bottom' || placed === 'top') {
    const left =
      align === 'start'
        ? a.left
        : align === 'end'
          ? a.right - s.width
          : a.left + (a.width - s.width) / 2;
    return {
      top: placed === 'bottom' ? a.bottom + offset : Math.max(0, a.top - s.height - offset),
      left: clamp(left, s.width, width),
      placed,
    };
  }

  const top =
    align === 'start'
      ? a.top
      : align === 'end'
        ? a.bottom - s.height
        : a.top + (a.height - s.height) / 2;
  return {
    top: clamp(top, s.height, height),
    left: placed === 'right' ? a.right + offset : Math.max(0, a.left - s.width - offset),
    placed,
  };
}

/**
 * The positioning, focus and dismissal behaviour underneath every overlay in the system
 * (`UI-34a`).
 *
 * `Select`, `Menu`, `Tooltip`, `Toast` and `Sheet` all need an anchor, an escape and a way not to
 * be underneath something -- and the two shipped overlays, `ProfileMenu` and `SearchResults`,
 * solve it with `position: absolute` inside the element that opens them, which works until the
 * anchor is inside anything that clips or scrolls. Settling it once here is the reason
 * `UI-34b`-`UI-34n` are one file each.
 *
 * **It is not exported from the barrel.** It is not a component and it is not a public API: it is
 * the shared answer to a question five components would otherwise each answer differently, and a
 * view that reaches for it directly is a view inventing a sixth overlay.
 *
 * What it does:
 *
 * - **Places the surface with `position: fixed`**, measured against the anchor, flipping to the
 *   roomier side and clamping into the viewport. Fixed rather than absolute so no ancestor's
 *   `overflow` can clip it; `tokens/layers.css` decides what sits on top of what, and this never
 *   invents a `z-index`.
 * - **Traps focus while `modal`**, moving focus in on open and returning it to the anchor on
 *   close. An overlay you can tab out of is one that stays open behind whatever you tabbed into.
 *   It lands on whatever inside carries `data-initial-focus`, and otherwise on the first
 *   focusable: a dialog whose first focusable is its close control opens on the one control that
 *   throws the dialog away, so anything somebody opened in order to type into has to be able to
 *   say so.
 * - **Closes on `Esc` and on a pointer outside** both the surface and the anchor -- the anchor
 *   excluded, because a trigger that toggles would otherwise close and reopen on one click and
 *   appear not to work at all.
 * - **Follows its anchor** through a scroll or a resize while open.
 * - **Locks the page's scroll on request**, which `Sheet` asks for and a menu must not.
 *
 * **The position is written to the element rather than held in state**, which is a decision and
 * not a shortcut. The surface follows its anchor through a scroll, and a scroll fires many times
 * a second: with the coordinates in `useState`, every one of those events would re-render the
 * component that owns the overlay and everything inside it, in order to move a box four pixels.
 * The side it landed on is written to the element as well, as `data-placement`, which is what a
 * `Tooltip`'s arrow and a `Select`'s radius read in CSS.
 *
 * What it deliberately does not do: portal the surface into `document.body`. React renders
 * `createPortal` children wherever the caller says, and the consuming components each choose --
 * `Sheet` wants the body, a `Tooltip` inside a dialog wants the dialog. `position: fixed` already
 * buys the part that matters, which is not being clipped.
 *
 * Nor does it make the background `inert`. The attribute exists and React passes it through, but
 * it has to go on the *rest* of the application -- which this cannot see, and which does not
 * exist yet: `UI-4c` builds the shell. The focus trap buys the behaviour that matters until then,
 * and `UI-24` is where the pointer half gets revisited with a real page to put it on.
 */
export function useAnchoredOverlay<
  Anchor extends HTMLElement = HTMLElement,
  Surface extends HTMLElement = HTMLDivElement,
>({
  open,
  onClose,
  placement = 'bottom',
  align = 'start',
  offset = 6,
  modal = true,
  lockScroll = false,
  anchored = true,
}: AnchoredOverlayOptions): AnchoredOverlay<Anchor, Surface> {
  const anchorRef = useRef<Anchor | null>(null);
  const surfaceRef = useRef<Surface | null>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const id = useId();

  const reposition = useCallback(() => {
    if (!anchored) return;
    const anchor = anchorRef.current;
    const surface = surfaceRef.current;
    if (anchor === null || surface === null) return;
    const { top, left, placed } = place(anchor, surface, placement, align, offset);
    surface.style.top = `${String(Math.round(top))}px`;
    surface.style.left = `${String(Math.round(left))}px`;
    surface.style.visibility = 'visible';
    surface.dataset.placement = placed;
  }, [align, anchored, offset, placement]);

  /* Before the browser paints, so the surface is never seen at the top left of the window on its
     way to its anchor. That is the whole reason this is a layout effect. */
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
  }, [open, reposition]);

  /* Focus in on open, and back to where it came from on close. To the anchor rather than the
     body: closing a menu should leave the keyboard on the button that opened it. */
  useEffect(() => {
    if (!open || !modal) return;
    const surface = surfaceRef.current;
    const anchor = anchorRef.current;
    returnTo.current = document.activeElement as HTMLElement | null;
    /* What the surface named, then the first thing inside, then the surface itself -- a listbox
       whose options are named by `aria-activedescendant` has no focusable children on purpose,
       and leaving focus outside it would send its own arrow keys to whatever opened it. The
       named control is taken from the focusables rather than queried on its own, so a marker on
       something a keyboard cannot reach falls through instead of swallowing the focus. */
    const focusable = surface === null ? [] : focusableIn(surface);
    ((focusable.find((element) => element.matches(INITIAL_FOCUS)) ?? focusable[0]) ??
      surface)?.focus();
    return () => {
      (returnTo.current ?? anchor)?.focus();
    };
  }, [modal, open]);

  /* Locked on the element that scrolls, and put back exactly as it was found: two overlays open
     at once -- a menu inside a sheet -- must not have the inner one restore scrolling to the
     page underneath the outer one. */
  useEffect(() => {
    if (!open || !lockScroll) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [lockScroll, open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !modal) return;
      const surface = surfaceRef.current;
      if (surface === null) return;
      const focusable = focusableIn(surface);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !surface.contains(active))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target === null) return;
      if (surfaceRef.current?.contains(target) === true) return;
      if (anchorRef.current?.contains(target) === true) return;
      onClose();
    };

    /* Capture on both: a click that closes the overlay must not also be the click that activates
       whatever was behind it, and an `Esc` handled here must not reach a view with its own. */
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', reposition);
    /* Capture, so a scroll in any container repositions and not only a scroll of the page.
       Passive, because this must never be the reason a scroll stutters. */
    document.addEventListener('scroll', reposition, { capture: true, passive: true });

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('scroll', reposition, true);
    };
  }, [modal, onClose, open, reposition]);

  /* An unanchored surface gets no placement style at all, rather than one it would have to
     override -- including the `visibility: hidden` that waits for a measurement that will never
     be taken. */
  return { anchorRef, surfaceRef, surfaceStyle: anchored ? SURFACE_STYLE : EMPTY_STYLE, id };
}
