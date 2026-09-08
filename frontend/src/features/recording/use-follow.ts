/**
 * Follow and release (`UI-12b`, §V5).
 *
 * 🔒 The centre of the product and the easiest thing on the screen to get subtly wrong. The
 * transcript scrolls itself to keep the line being spoken in view, and **the moment the person
 * reading it scrolls, that stops**. Getting it wrong in either direction ruins the screen: a
 * transcript that keeps yanking itself back cannot be read ahead of the audio, and one that never
 * follows makes somebody chase a highlight down a thousand lines.
 *
 * **The hard part is telling our own scroll from theirs.** Both arrive as the same `scroll` event
 * on the same element, and the browser offers nothing to distinguish them. The prototype's
 * reference implementation sets a flag before it moves the scroller and clears it 80 ms later,
 * and `UI-12b` says to keep that -- so this is that mechanism, with two things spelled out that
 * a fixed 80 ms alone does not cover:
 *
 * **A smooth scroll is many events, not one.** `scrollTo({ behavior: 'smooth' })` fires a scroll
 * event per frame until it arrives, which outlasts any fixed window -- so while the flag is armed
 * each event re-arms it, and the window closes 80 ms after the movement stops. A fixed window
 * would have the follow release itself halfway through its own animation, which is the bug this
 * whole module exists to avoid.
 *
 * **A person can scroll during our animation**, and re-arming would attribute their wheel to us.
 * So the unambiguous signals -- a wheel, a touch drag -- release immediately whatever the flag
 * says. They cannot be anything but a person, and a scroll nobody can explain is exactly the sort
 * of thing that makes an interface feel like it is arguing.
 *
 * **Releasing is not the same as stopping.** Following is offered back through a persistent band
 * (`UI-12b` is emphatic: never a toast that vanishes before it is read), and playing, seeking or
 * clicking a line takes it up again, because all three are somebody saying where they want to be.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** How long after a scroll we caused a scroll event still counts as ours. The prototype's. */
export const OWN_SCROLL_MS = 80;

/** How far the scroller may already be from the target before it is worth moving. */
export const CLOSE_ENOUGH_PX = 6;

export interface Follow {
  /** Whether the transcript is currently keeping up with playback. */
  following: boolean;
  /** Take it up again. What the band's control calls, and what seeking calls. */
  resume: () => void;
  /** A scroll event on the scroller. Releases unless we caused it. */
  onScroll: () => void;
  /** Move the scroller so an offset is centred, without releasing. */
  centreOn: (offset: number) => void;
}

/**
 * Keep a scroller following something, until the person reading it says otherwise.
 *
 * `smooth` is the caller's answer to `prefers-reduced-motion` (`UI-32c`): the scroll is the one
 * thing in the product that moves on its own, and no stylesheet can intervene in a `scrollTo`.
 */
export function useFollow(scroller: RefObject<HTMLElement | null>, smooth: boolean): Follow {
  const [following, setFollowing] = useState(true);
  /** Whether a scroll event arriving now is one we caused. */
  const ours = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const arm = useCallback(() => {
    ours.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      ours.current = false;
    }, OWN_SCROLL_MS);
  }, []);

  const release = useCallback(() => {
    setFollowing((was) => (was ? false : was));
  }, []);

  // A wheel or a touch drag is a person, whatever the flag says -- including during our own
  // animation, which is when re-arming would otherwise swallow it.
  useEffect(() => {
    const element = scroller.current;
    if (element === null) return;
    element.addEventListener('wheel', release, { passive: true });
    element.addEventListener('touchmove', release, { passive: true });
    return () => {
      element.removeEventListener('wheel', release);
      element.removeEventListener('touchmove', release);
    };
  }, [scroller, release]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );

  return {
    following,
    resume: () => {
      setFollowing(true);
    },
    onScroll: () => {
      if (ours.current) {
        // Still converging on where we sent it. Each frame of a smooth scroll lands here.
        arm();
        return;
      }
      release();
    },
    centreOn: (offset) => {
      const element = scroller.current;
      if (element === null) return;
      const target = Math.max(0, Math.min(offset, element.scrollHeight - element.clientHeight));
      // A scroll that would not move anything is not worth claiming: arming the flag for it
      // would leave an 80 ms window in which a person's own scroll reads as ours.
      if (Math.abs(element.scrollTop - target) < CLOSE_ENOUGH_PX) return;
      arm();
      element.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' });
    },
  };
}
