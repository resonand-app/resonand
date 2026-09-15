/**
 * Keeping your place in a library across the recording you opened from it (`FBK-8`).
 *
 * Both densities lose the same thing and lose it the same way, so both ask this for the same two
 * favours: take the offsets with you on the way out, and put them back on the way in.
 *
 * **It belongs to the thing that scrolled, not to the view above it.** `LibraryView` draws six
 * different screens and only two of them have a place to keep; the grid and the dense list are
 * the two, they are what mounts once the recordings are in hand, and an effect that runs then is
 * an effect that runs with something to scroll.
 *
 * **The page scrollport is walked to rather than named** (`scrollParentOf`), because it is the
 * frame's box and which frame drew it is not a list's business.
 *
 * The dense list hands in its own scroller as well. It is the inner one and it is the one that
 * matters at the length the density exists for: with eight hundred rows, the page has barely
 * moved and the list has moved twenty-six screens.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { fromList, stayingAt, useCameFromOffsets } from '@/app/came-from';
import { toRecording } from '@/app/routes';
import { putBack, scrollParentOf } from '@/app/scroll';

export interface KeepPlace {
  /** Goes on the list's own root, so the frame's scrollport can be found from inside the view. */
  root: RefObject<HTMLDivElement | null>;
  /** Open a recording, leaving a note of where this list was when it was left. */
  open: (uuid: string) => void;
}

export function useKeepPlace(scroller?: RefObject<HTMLElement | null>): KeepPlace {
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const offsets = useCameFromOffsets();
  // The numbers rather than the record: `useCameFromOffsets` validates foreign state into a fresh
  // object on every render, and an effect keyed on that would restore the scroll on every one of
  // them -- including the renders somebody's own scrolling causes.
  const page = offsets?.page ?? 0;
  const inList = offsets?.list ?? 0;

  useEffect(() => {
    const element = scrollParentOf(root.current);
    if (element === null) return;
    return putBack(element, page);
  }, [page]);

  useEffect(() => {
    const element = scroller?.current ?? null;
    if (element === null) return;
    return putBack(element, inList);
  }, [scroller, inList]);

  // Stable, because it reads the refs and a card is handed it during render: a fresh closure over
  // `current` on every render is the thing `react-hooks/refs` is about.
  const open = useCallback(
    (uuid: string) => {
      const here = {
        page: scrollParentOf(root.current)?.scrollTop ?? 0,
        ...(scroller?.current == null ? {} : { list: scroller.current.scrollTop }),
      };
      // Onto this entry first, which is the one a Back pops to and which the push below would
      // otherwise leave saying nothing. Then out to the recording, for the breadcrumb.
      void navigate({ pathname: location.pathname, search: location.search }, stayingAt(here));
      void navigate(toRecording(uuid), fromList(location.search, here));
    },
    [location.pathname, location.search, navigate, scroller],
  );

  return { root, open };
}
