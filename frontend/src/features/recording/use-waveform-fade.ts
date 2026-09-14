/**
 * The player panel dissolving as the transcript takes the screen (`UI-11g`, `UI-11h`).
 *
 * The waveform and the transcript are one scrolling section, so on a short screen the transcript
 * is one scroll away from filling it rather than a band under a picture that owns most of the
 * viewport. What happens on the way is this: the panel fades as it leaves, and the bar at the
 * foot of the shell picks the waveform up when it has gone.
 *
 * **The opacity is written to the node rather than held in state.** A scroll-linked value in
 * `useState` re-renders the panel on every frame of a scroll, and this panel draws a few hundred
 * `<rect>`s -- so the fade is a style write inside a frame callback, and React only hears about
 * the one thing it has to know, which is that the shape moved to the other surface.
 *
 * **The handover has two thresholds, not one.** With a single one, parking the scroll on it makes
 * a trackpad's own jitter flip the bar's waveform in and out; a thermostat does not switch at
 * 20.0 degrees in both directions either.
 *
 * **An invisible seek control is still a seek control**, so the panel goes `inert` when the fade
 * has finished: no pointer target, no tab stop, nothing under the transcript to land on. The bar
 * is holding the same transport by then.
 */

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useOnScreenWaveform } from '@/player/on-screen';

/**
 * How much of the panel's own height the fade is spread over.
 *
 * Under 1 so the picture is gone before its box is: the last thing that should happen to a
 * waveform on the way out is being clipped in half against the top of the scrollport.
 */
const FADE_OVER = 0.8;

/** Faded to here, the bar takes the waveform. */
const GONE = 0.05;

/** Scrolled back to here, the panel takes it again. The gap between the two is the dead band. */
const BACK = 0.25;

/**
 * Fade the panel as the column scrolls it away, and say which surface owns the waveform.
 *
 * Hands back the ref for the panel to carry rather than taking one: the opacity is written
 * straight to the node on every frame of a scroll, and a node reached through somebody else's ref
 * is a node this has no business writing to.
 *
 * Does nothing without a scroller: the phone shell hands its views no settled height, so there
 * is no column to scroll and the panel stays where it is (`DEC-23`).
 */
export function useWaveformFade(
  scroller: RefObject<HTMLElement | null> | undefined,
  uuid: string | undefined,
): RefObject<HTMLElement | null> {
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const column = scroller?.current ?? null;
    const element = panel.current;
    if (column === null || element === null || uuid === undefined) return;

    const { show, hide } = useOnScreenWaveform.getState();
    let frame = 0;
    let shown = false;

    const draw = () => {
      frame = 0;
      const travel = element.offsetHeight * FADE_OVER;
      const gone = travel <= 0 ? 0 : Math.min(1, Math.max(0, column.scrollTop / travel));
      const opacity = 1 - gone;
      element.style.opacity = String(opacity);
      element.inert = opacity <= GONE;
      if (!shown && opacity >= BACK) {
        shown = true;
        show(uuid);
      } else if (shown && opacity <= GONE) {
        shown = false;
        hide(uuid);
      }
    };

    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(draw);
    };

    // The panel is not always the same height -- the transport rewraps, the line about the peaks
    // still being made comes and goes -- and the travel is measured from it.
    const resized = new ResizeObserver(draw);
    resized.observe(element);
    resized.observe(column);
    column.addEventListener('scroll', onScroll, { passive: true });
    draw();

    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      column.removeEventListener('scroll', onScroll);
      hide(uuid);
    };
  }, [scroller, uuid]);

  return panel;
}
