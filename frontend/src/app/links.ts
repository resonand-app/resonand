/**
 * Whether a click on a link is the application's to answer (`UI-4e`).
 *
 * The interface draws real `<a href>`s at routes, and following one is a full page load -- so they
 * cancel the browser's navigation and call `navigate`. Not when a modifier or a middle button
 * asked for a new tab, which is the reason those links are links.
 */

import type { MouseEvent } from 'react';

export function isPlainClick(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  return !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}
