/**
 * Where everything is (`UI-4a`, §2.1).
 *
 * Eight routes and one builder each, so no view ever writes a path as a string. A typo in
 * `/recording/${uuid}` is a not-found page that looks like a missing recording, which is the
 * worst kind of bug to be told about: the person reporting it describes the recording.
 *
 * **Public identifiers are uuids** (`DEC-14`). A sequential id never appears in a URL, so these
 * builders take one and there is no other kind to pass.
 *
 * The namespace these live in is settled by `DEC-24`: the API is under `/api` and the interface
 * owns everything else, so `/search`, `/trash` and `/settings` are routes rather than endpoints
 * and a hard refresh on any of them reaches the shell.
 */

export const routes = {
  signIn: '/sign-in',
  libraries: '/',
  library: '/library/:uuid',
  librarySettings: '/library/:uuid/settings',
  recording: '/recording/:uuid',
  search: '/search',
  trash: '/trash',
  settings: '/settings',
} as const;

export const toLibrary = (uuid: string): string => `/library/${encodeURIComponent(uuid)}`;

export const toLibrarySettings = (uuid: string): string => `${toLibrary(uuid)}/settings`;

export const toRecording = (uuid: string): string => `/recording/${encodeURIComponent(uuid)}`;

/** The search view, with a query and whatever filters were already set. */
export function toSearch(query: string, filters?: URLSearchParams): string {
  const parameters = new URLSearchParams(filters);
  if (query) parameters.set('q', query);
  else parameters.delete('q');
  const rendered = parameters.toString();
  return rendered ? `${routes.search}?${rendered}` : routes.search;
}

/** What a query string is asking for, so the nav field can say what the screen is showing. */
export function queryIn(search: string): string {
  return new URLSearchParams(search).get('q') ?? '';
}

/** Whether a path is the one public route, which is the only question the guard has to ask. */
export const isPublic = (pathname: string): boolean => pathname === routes.signIn;
