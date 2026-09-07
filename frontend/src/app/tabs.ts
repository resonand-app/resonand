/**
 * The phone's four destinations (`UI-4f`, §2.3).
 *
 * Beside the shell rather than in it, so which tab a path belongs to can be read and tested
 * without rendering a phone around it.
 */

import { routes } from './routes';

export type PhoneTab = 'libraries' | 'search' | 'upload' | 'settings';

/**
 * Which tab a path belongs to.
 *
 * A library, a recording and the trash are all inside Libraries: they are reached from it, and a
 * bottom bar that lit nothing on two thirds of the screens would be a bar nobody reads.
 */
export function tabOf(pathname: string): PhoneTab {
  if (pathname.startsWith(routes.search)) return 'search';
  if (pathname.startsWith(routes.settings)) return 'settings';
  return 'libraries';
}
