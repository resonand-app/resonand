/**
 * The one rule the system does not bend, written once (`UI-1i`).
 *
 * **No colour is ever written inside a component.** Every value comes from a token, because that
 * is what makes `[data-theme="light"]` a redefinition rather than a second stylesheet, and what
 * lets `UI-33c` audit AA contrast by checking token pairs instead of grepping the tree.
 *
 * It is enforced twice, from this one description: ESLint reads the patterns below so the failure
 * arrives while the hex is being typed, and `token-adherence.node.test.ts` reads them so it also
 * arrives in CI on a machine where nobody ran the editor. Two mechanisms, one definition -- a
 * second copy of these regexes is a second rule that would quietly diverge from the first.
 *
 * `ui-plan.md` says to port the three rules `_adherence.oxlintrc.json` already encodes. **That
 * file does not exist in this repository** -- neither in the tree nor anywhere in its history --
 * so these are authored rather than ported, and the count of three is theirs rather than a
 * constraint. What is here is a colour rule, a font rule, a type rule, and the exemption list
 * that makes the first of them land against code that already breaks it.
 *
 * **The colour and font rules read values; the type rule reads properties** (`UI-33a1`). A hex is
 * recognisable wherever it is written, so a pattern over the text finds it. A leading is the bare
 * number `1.5`, which is a colour's opposite: meaningless on its own and unmistakable next to the
 * property it is assigned to. So the third rule matches `lineHeight`, `letterSpacing`, `fontSize`
 * and `fontWeight` and asks what they were given, and the first rule's shape would have had to
 * ban every number in the tree to see the same thing.
 *
 * `fontFamily` is deliberately not in that list. A family is a name wherever it appears -- in a
 * style property, in a `?raw` stylesheet, in a constant -- so it stays with the font rule, which
 * reads names, and the generic families are in that pattern for the same reason.
 */

/**
 * A CSS colour written as a value: `#C4574A`, `#fff`, `rgba(...)`, `hsl(...)`.
 *
 * The hex half is anchored so it cannot match a fragment reference -- `url(#wave-3f2a)` is how the
 * waveform clips its played half, and a rule that called that a colour would be a rule everybody
 * turns off.
 */
export const COLOUR_PATTERN =
  '#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![0-9a-zA-Z])|(?:rgba?|hsla?)\\s*\\([^)]*\\)';

/**
 * A font stack written out instead of taken from a token.
 *
 * Three families, three jobs, no fourth case -- and the fallback stacks belong in
 * `tokens/typography.css` where all three are declared together.
 */
export const FONT_PATTERN =
  '\\b(?:Geist|Gabarito|ui-sans-serif|ui-monospace|system-ui|SFMono-Regular|sans-serif|serif|monospace)\\b';

export const COLOUR_MESSAGE =
  "No colour inside a component. Use a token: token('--accent') or var(--accent).";
export const FONT_MESSAGE =
  'No font stack inside a component. Use var(--font-sans), var(--font-mono) or var(--font-display).';

/**
 * The four type properties that carry a number, and so a scale (`UI-33a1`).
 *
 * `fontFamily` is not here: see the note at the top. Spacing is not here either -- `padding: 8`
 * is a layout number and `UI-33b`'s tokens are a different argument from this one.
 */
export const TYPE_PROPERTIES = ['lineHeight', 'letterSpacing', 'fontSize', 'fontWeight'];

/** Those four, as an alternation, for a `Property[key.name=...]` selector and for the scanner. */
export const TYPE_PROPERTY_PATTERN = `(?:${TYPE_PROPERTIES.join('|')})`;

/**
 * What one of them may be given: a token, or a keyword that states no opinion.
 *
 * `inherit` is how `RecordingList` hands a row's tracking to the highlight inside it, and `normal`
 * is the initial value -- neither is a value somebody chose, so neither can drift from the scale.
 * `undefined` is the third, and it is an identifier rather than a literal, so only the scanner
 * ever sees it.
 */
export const TYPE_VALUE_PATTERN = '^(?:var\\(--|inherit$|normal$)';

export const TYPE_MESSAGE =
  'No type value inside a component. Read the scale: lineHeight/letterSpacing/fontSize/fontWeight take var(--type-*) or var(--weight-*).';

/**
 * The bypasses that already exist, and the task that removes each one.
 *
 * **Empty, as of `UI-33a`.** It held two: `TextField`'s `#C4574A` error ring, which matched no
 * token in the system, and `Button`'s hard-coded amber glow, which was therefore the dark-mode
 * glow underneath a light-mode button. The first is `--state-failed` now and the second is
 * `--elevation-accent`, which flips.
 *
 * The list only ever shrinks, and the test asserts both directions -- an unlisted bypass fails,
 * and a listed one that no longer exists fails too. That second half is what emptied this: the
 * commit that fixed the two colours could not land while its own excuses were still here. Leave
 * it empty. An entry added later is a promise to somebody that it will be removed again, so it
 * needs a task identifier in `why` and the test checks for one.
 */
export const KNOWN_BYPASSES = /** @type {{file: string, value: string, why: string}[]} */ ([]);

/**
 * The end of a string, template or regex literal starting at `open`, so the scanner below does not
 * read a `,` inside `'8px, 4px'` as the end of a value.
 *
 * @param {string} source
 * @param {number} open
 * @returns {number} the index after the closing quote
 */
function endOfString(source, open) {
  const quote = source[open];
  for (let i = open + 1; i < source.length; i += 1) {
    if (source[i] === '\\') i += 1;
    else if (source[i] === quote) return i + 1;
  }
  return source.length;
}

/**
 * The expression a property was given, from just after its colon to the `,` or `}` that ends it.
 *
 * Brackets are counted rather than matched by a regex because `active ? 'a' : 'b'` and
 * `calc(var(--x) * 2)` both contain characters a regex would stop at.
 *
 * @param {string} source
 * @param {number} start index just after the colon
 * @returns {string}
 */
function valueAfter(source, start) {
  let depth = 0;
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) break;
      depth -= 1;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      i = endOfString(source, i);
      continue;
    } else if (depth === 0 && (ch === ',' || ch === ';')) break;
    i += 1;
  }
  return source.slice(start, i).trim().replace(/\s+/g, ' ');
}

/**
 * Every line of a source file that writes a colour, a font stack or a type value.
 *
 * Comments are stripped first: this file's own prose names `#C4574A` and `Geist`, and so do the
 * explanations beside the two exemptions.
 *
 * The first two kinds are found by reading values, the third by reading properties -- the note at
 * the top of this file says why. The third is also the looser of the two halves it feeds: it asks
 * whether a token is mentioned anywhere in the expression, where ESLint reads the literal itself.
 * A ternary whose branches disagree about the scale therefore fails in the editor and not here,
 * which is the direction that costs nothing.
 *
 * @param {string} source
 * @returns {{ line: number, value: string, kind: 'colour' | 'font' | 'type' }[]}
 */
export function findBypasses(source) {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (match) => match.replace(/[^\n]/g, ' '));

  /** @type {{ line: number, value: string, kind: 'colour' | 'font' | 'type' }[]} */
  const found = [];
  for (const [kind, pattern] of /** @type {const} */ ([
    ['colour', COLOUR_PATTERN],
    ['font', FONT_PATTERN],
  ])) {
    for (const match of stripped.matchAll(new RegExp(pattern, 'g'))) {
      const line = stripped.slice(0, match.index).split('\n').length;
      found.push({ line, value: match[0], kind });
    }
  }

  const allowed = new RegExp(TYPE_VALUE_PATTERN);
  for (const match of stripped.matchAll(new RegExp(`\\b${TYPE_PROPERTY_PATTERN}\\s*:`, 'g'))) {
    const value = valueAfter(stripped, match.index + match[0].length);
    const bare = value.replace(/^['"`]|['"`]$/g, '');
    if (value.includes('var(--') || allowed.test(bare) || bare === 'undefined') continue;
    const line = stripped.slice(0, match.index).split('\n').length;
    found.push({ line, value: `${match[0].replace(/\s*:$/, '')}: ${value}`, kind: 'type' });
  }

  return found.sort((a, b) => a.line - b.line);
}
