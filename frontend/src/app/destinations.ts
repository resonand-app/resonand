/**
 * Which sidebar entry is lit, and where each one goes (`UI-4d`).
 *
 * Beside the shell rather than in it, so the mapping can be read and tested without rendering a
 * frame around it -- and so the shell file exports components and nothing else.
 */

import { routes, toLibrary } from './routes';

/**
 * Which sidebar entry is lit.
 *
 * A library's own settings page is still that library, and a recording is not any destination --
 * it is reached from one and lighting the library it belongs to would mean fetching the recording
 * to find out.
 */
export function destinationOf(pathname: string): string {
  if (pathname.startsWith('/library/')) return pathname.split('/')[2] ?? 'libraries';
  if (pathname.startsWith(routes.trash)) return 'trash';
  if (pathname.startsWith(routes.settings)) return 'settings';
  if (pathname === routes.libraries) return 'libraries';
  return '';
}

/** Where a sidebar entry goes. The three fixed ones, and a library by its uuid. */
export function destinationTo(id: string): string {
  if (id === 'libraries') return routes.libraries;
  if (id === 'trash') return routes.trash;
  if (id === 'settings') return routes.settings;
  return toLibrary(id);
}

/** Initials, because there are no avatar images anywhere in the product. */
export function initialsOf(name: string | undefined): string {
  if (!name) return '';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');
}
