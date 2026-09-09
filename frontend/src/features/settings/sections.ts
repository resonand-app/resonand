/**
 * Which section Settings is showing, and where it is written down (`UI-20a`, §V10).
 *
 * Beside the view rather than in it, the way `destinations.ts` and `tabs.ts` sit beside the
 * shell: which section a URL asks for is a fact about a URL, and it can be read and tested
 * without rendering four panels around it.
 *
 * **The section is in the URL.** It is a thing people link and reload into -- "the sessions page"
 * is a sentence somebody says -- which is `UI-4b`'s test for what the address bar carries.
 */

/** The four §V10 names, in its order. */
export const SECTIONS = ['account', 'sessions', 'appearance', 'administration'] as const;

export type Section = (typeof SECTIONS)[number];

/** Where the section lives in the address bar. */
export const SECTION_PARAM = 'section';

/**
 * The section a URL is asking for, given whether the caller may see the fourth one.
 *
 * An unknown section, and Administration asked for by somebody who is not an administrator, both
 * fall back to Account rather than rendering nothing: a shared link opened by the wrong person
 * should land on a real screen, and a blank panel would read as a broken one. It is not a
 * permission check -- the API refuses those requests whoever asks -- it is what to draw.
 */
export function sectionIn(asked: string | null, isAdmin: boolean): Section {
  const found = SECTIONS.find((one) => one === asked);
  if (found === undefined) return 'account';
  if (found === 'administration' && !isAdmin) return 'account';
  return found;
}
