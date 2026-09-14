/**
 * How a typed name is compared with the real one (`UI-34m`).
 *
 * Its own module rather than a second export from `TypedConfirm.tsx`, for the reason `peaks.ts`
 * is one: this is a decision with four parts, each of which somebody will want to look up, and a
 * rule about deleting an archive should not be reachable only through the component that happens
 * to ask for it.
 */

/**
 * Whether what was typed is the name.
 *
 * **Case-insensitive, accent-sensitive, trimmed, and normalised.** Each of those is a decision,
 * and the prototype's bare `===` took none of them -- which matters here more than anywhere,
 * because a library name is whatever somebody typed: "Álbum", "Interviews '98", "Rehearsals".
 *
 * - **Normalised**, because `À` has two Unicode spellings -- one code point, or an `A` followed by
 *   a combining grave -- and a macOS keyboard and a Linux one do not always produce the same one.
 *   Two strings that look identical on screen and compare unequal is the worst possible failure
 *   for a confirmation somebody is copying by eye.
 * - **Trimmed**, because a trailing space from a double-tap on a phone keyboard is not a
 *   different library.
 * - **Case-insensitive**, because shift is a typing convention and not part of the name. Requiring
 *   it makes the gesture about spelling rather than about deliberateness.
 * - **Accent-sensitive**, because an accent is part of the word. "Album" is not "Álbum", and
 *   this is the one place in the product where being strict costs a retype and being lax costs a
 *   library.
 */
export function matchesName(typed: string, name: string): boolean {
  const clean = (value: string) => value.normalize('NFC').trim().toLocaleLowerCase();
  return name !== '' && clean(typed) === clean(name);
}
