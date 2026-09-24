/**
 * Where a key moves focus inside a menu (`UI-34c`, `INF-24a`).
 *
 * The arrow keys step and wrap, and Home and End jump. Written once so the two menus somebody
 * meets -- a recording's actions and their own account -- walk the same way; each hands over its
 * own rows in the order they are drawn. Returns whether the key was one of the four, so the caller
 * knows to keep it from scrolling the page as well.
 */
export function stepMenuFocus(key: string, items: readonly (HTMLElement | null)[]): boolean {
  const count = items.length;
  if (count === 0) return false;
  const at = items.findIndex((item) => item === document.activeElement);
  let next: number;
  switch (key) {
    case 'ArrowDown':
      next = at + 1;
      break;
    case 'ArrowUp':
      next = at - 1;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = count - 1;
      break;
    default:
      return false;
  }
  items[((next % count) + count) % count]?.focus();
  return true;
}
