/**
 * Whether the stylesheet, rather than the browser, paints an element.
 *
 * jsdom loads no CSS, so a row the stylesheet has no rule for looks exactly like one it has: both
 * render, both click. In a browser the first is drawn with the platform's own button face, light
 * grey and edge to edge in either theme. The difference is only visible as a claim
 * `components.css` makes about a `data-ds` name, so that is what this reads.
 */

import CSS from '@/design-system/components.css?raw';
import { ownedProperties } from '@/test/interaction-layer';

const OWNED = ownedProperties(CSS);

/** The properties `components.css` sets for the element's `data-ds` name, if it has one. */
export function paintedBy(element: HTMLElement): Set<string> {
  return OWNED.get(element.dataset.ds ?? '') ?? new Set<string>();
}
