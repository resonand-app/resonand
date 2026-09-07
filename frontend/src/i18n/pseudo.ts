/**
 * The `+30%` locale (`UI-22d`).
 *
 * German and Catalan run about 30% longer than English, and the filter bar and the dense list are
 * where that breaks first (§1.6). Checking it should be a switch rather than a spreadsheet, so
 * this generates a locale from the English one by making every string 30% longer and visibly not
 * English -- a label that has not been externalised stays short and Latin, which is how it is
 * spotted.
 *
 * Two things it does not touch: interpolation placeholders, because `{{count}}` has to survive
 * to be replaced; and the brackets it wraps each string in, which are what show truncation. A
 * string that ends in `»` is complete, and one that does not has been cut off by a layout.
 */

/** How much longer the pseudo-locale is than the English it came from. */
export const EXPANSION = 0.3;

const ACCENTED: Record<string, string> = {
  a: 'á',
  e: 'é',
  i: 'í',
  o: 'ó',
  u: 'ú',
  A: 'Á',
  E: 'É',
  I: 'Í',
  O: 'Ó',
  U: 'Ú',
};

/** One string, 30% longer and unmistakably not English. */
export function pseudo(value: string): string {
  const parts = value.split(/(\{\{[^}]+\}\})/g);
  const expanded = parts.map((part) => (part.startsWith('{{') ? part : accent(part))).join('');
  const padding = Math.ceil(withoutPlaceholders(value).length * EXPANSION);
  return `«${expanded}${'·'.repeat(Math.max(1, padding))}»`;
}

/** Every string in a bundle of them, however deeply nested. */
export function pseudoBundle(resource: unknown): unknown {
  if (typeof resource === 'string') return pseudo(resource);
  if (Array.isArray(resource)) return resource.map(pseudoBundle);
  if (typeof resource === 'object' && resource !== null) {
    return Object.fromEntries(
      Object.entries(resource).map(([key, value]) => [key, pseudoBundle(value)]),
    );
  }
  return resource;
}

function accent(part: string): string {
  // A replace over the five vowels rather than a walk over the characters: the strings being
  // transformed are the product's own copy, but a tag or a title could reach this in a snapshot,
  // and splitting one of those into code points is how an accent becomes two characters.
  return part.replace(/[aeiouAEIOU]/g, (vowel) => ACCENTED[vowel] ?? vowel);
}

function withoutPlaceholders(value: string): string {
  return value.replace(/\{\{[^}]+\}\}/g, '');
}
