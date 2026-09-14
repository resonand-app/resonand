/**
 * A name, as the two letters the product draws in a circle (`UI-35d`).
 *
 * Its own module because two things need it and neither should own it: `AvatarStack` draws a
 * library's people, and `TopNav` and `ProfileMenu` draw the account. Two implementations would
 * eventually disagree about "Ángela Ruiz", which is the kind of difference nobody reports and
 * everybody notices.
 */

/**
 * Grapheme clusters, so a letter with a combining accent stays one letter.
 *
 * `name[0]` and `[...name][0]` both take a UTF-16 unit and a code point respectively, and neither
 * is a letter: a decomposed `Á` is `A` followed by a combining acute, so both would return a bare
 * `A` and quietly drop the accent from somebody's name. `Intl.Segmenter` is the only thing in the
 * platform that answers the question actually being asked.
 */
const GRAPHEMES = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function firstLetter(word: string): string {
  for (const { segment } of GRAPHEMES.segment(word)) return segment;
  return '';
}

/**
 * Initials, in the two-letter form the product uses everywhere.
 *
 * The first letter of the first word and of the last -- right for "Ángela Ruiz" and for "Ana
 * Maria Ruiz", and one letter rather than a blank circle for a single-word name. There are no
 * avatar
 * images anywhere in this product: no storage exists for one, and fetching one from an external
 * service would break the promise that nothing leaves the instance.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = firstLetter(words[0] ?? '');
  const last = words.length > 1 ? firstLetter(words[words.length - 1] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}
