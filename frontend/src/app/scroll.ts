/**
 * Putting a scrollport back where it was (`FBK-8`).
 *
 * `came-from.ts` settles what a list remembers about itself and how that travels; this is the
 * mechanism underneath it, and it is separate because it is about the DOM and nothing else.
 *
 * **The scrollport is found rather than named.** The box a view scrolls in belongs to whichever
 * frame drew it -- `<main data-ds="shell-content">` on the desktop, the phone shell's own `<main>`
 * below 720 -- and a view has no business knowing which of them it is inside. So it is reached by
 * walking up from a node the view does own, which is the same answer in both shells and stays the
 * same answer when a third one appears.
 *
 * **Restoring is not one assignment.** The list arrives before the recordings do: for the frame
 * or two while the query is in flight the page is skeletons, the scrollport is shorter than it
 * will be, and a browser clamps a `scrollTop` past the end to the end. So the offset is asked for
 * again on each frame until it takes -- and `element.scrollTop === top` is how "it took" is read,
 * because that is precisely what the clamp denies.
 *
 * It gives up after `PATIENCE`, and it gives up the moment somebody scrolls for themselves. A
 * restoration that wins a fight with a hand on the wheel is worse than one that never happened.
 */

/** How long to keep asking for an offset the content cannot reach yet. */
const PATIENCE_MS = 1000;

/** The nearest ancestor that scrolls, which is the box the frame gave this view. */
export function scrollParentOf(node: Element | null): HTMLElement | null {
  for (let parent = node?.parentElement ?? null; parent !== null; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
  }
  return null;
}

/**
 * Ask `element` for `top` until it can honour it, and stop.
 *
 * Hands back a cancel, because the caller is an effect and the view can be left before the
 * content that would make the offset reachable ever arrives.
 */
export function putBack(element: HTMLElement, top: number): () => void {
  if (top <= 0) return () => undefined;

  const deadline = performance.now() + PATIENCE_MS;
  let frame = 0;
  // What this last left the scrollport at, so a scroll that is somebody else's can be told from
  // its own. Seeded with where the scrollport already is rather than with a value it can never
  // hold: an event arriving before the first frame would otherwise read as a hand on the wheel.
  let asked = element.scrollTop;
  // Its own writes are not somebody scrolling, however the event is delivered. A browser sends it
  // after the fact, when `asked` already says what to expect; this covers the write itself, where
  // `asked` is still describing the frame before.
  let writing = false;

  const abandon = () => {
    if (frame !== 0) cancelAnimationFrame(frame);
    frame = 0;
    element.removeEventListener('scroll', onScroll);
  };

  function onScroll() {
    if (!writing && element.scrollTop !== asked) abandon();
  }

  const tick = () => {
    frame = 0;
    writing = true;
    element.scrollTop = top;
    asked = element.scrollTop;
    writing = false;
    if (asked === top || performance.now() > deadline) {
      abandon();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  element.addEventListener('scroll', onScroll, { passive: true });
  frame = requestAnimationFrame(tick);
  return abandon;
}
