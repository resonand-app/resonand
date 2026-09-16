/**
 * How tall the row that sticks above the list currently is (`UI-9a`).
 *
 * The filter bar and the bulk bar that replaces it are both one `--hit-target` tall at 1440 and
 * both wrap to two rows and then three as the space narrows -- four filter controls, a sort and a
 * density switch do not fit a 1080px window with the sidebar out. So the dense list's own sticky
 * column header cannot be offset by a constant: written as one, it was hidden behind the second
 * row of a wrapped bar at exactly the widths where the bar wraps.
 *
 * A measurement and not a guess, therefore, and a `ResizeObserver` because the thing that changes
 * it -- a window resized, a font arriving, a filter chip appearing -- is not a render of this
 * view. `UploadTray` measures its scrollport the same way and for the same reason.
 */

import { useCallback, useRef, useState } from 'react';

export function useStickyHeader(): [(node: HTMLDivElement | null) => void, number] {
  const [height, setHeight] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const attach = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (node === null) return;
    setHeight(node.getBoundingClientRect().height);
    // jsdom has none, and a list whose header sits at zero is the right answer there: the
    // alternative is every test of this view stubbing a browser API to read one number.
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(() => {
      setHeight(node.getBoundingClientRect().height);
    });
    observer.current.observe(node);
  }, []);

  return [attach, height];
}
